const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://davidtottenhamroc_db_user:David0724.@cluster0.huj6sbw.mongodb.net/?appName=Cluster0";
const PORT = process.env.PORT || 3000; 


app.use(cors()); // Permite requisições do front-end (index.html)
app.use(express.json());

// ==============================
// 1. CONEXÃO COM O MONGO DB
// ==============================
mongoose.connect(MONGO_URI)
    .then(() => console.log('Conectado ao MongoDB.'))
    .catch(err => console.error('Erro de conexão ao MongoDB:', err));

// ==============================
// 2. SCHEMAS E MODELOS
// ==============================

// Schema do Usuário (N1, N2, Gestao)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    level: { type: String, enum: ['N1', 'N2', 'Gestao'], default: 'N1' }
});

// Pré-save para hash de senha
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// Schema das Regras (Baseado nos dados do CSV)
const ruleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    states: { type: Map, of: String } // Armazena pares de estado:regra (ex: PE: "50 min")
});

const Rule = mongoose.model('Rule', ruleSchema);

// ==============================
// 3. MIDDLEWARE DE AUTENTICAÇÃO
// ==============================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ message: 'Token não fornecido.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado.' });
        req.user = user; // Adiciona os dados do usuário (username, level) ao request
        next();
    });
}

// ==============================
// 4. ROTAS DE AUTENTICAÇÃO (API)
// ==============================

// Rota para Iniciar o Banco de Dados com as Regras Iniciais
async function initializeRules() {
    const initialRules = [
        { name: "Data de Corte teórico", states: { "AL": "01/02/2022", "PE": "01/01/2018", "PB": "abr./ 2013", "CE": "13/07/2017", "RN": "11/09/2017", "GO": "22/01/2018", "SE": "-", "BA": "-", "ES": "-", "MA": "-" } },
        { name: "Data de Corte prático B", states: { "AL": "31/03/2017", "PE": "01/04/2017 / C, D e E 01/08/2022", "PB": "04/07/2017", "CE": "13/08/2017", "RN": "21/12/2018", "GO": "22/01/2018", "SE": "(Em SERGIPE as datas de corte são por regional)", "BA": "15/12/2019", "ES": "-", "MA": "08/05/2023" } },
        { name: "Tempo minimo regulamentado", states: { "AL": "50 min", "PE": "50 min", "PB": "45 min", "CE": "50 min (5 min tolerância)", "RN": "50 minutos", "GO": "50 min", "SE": "50 min", "BA": "Diurno: 50 min", "ES": "50 min", "MA": "50 min" } },
        // ... (Insira todas as regras do seu CSV aqui) ...
    ];

    try {
        for (const rule of initialRules) {
            // Insere apenas se a regra não existir
            await Rule.findOneAndUpdate({ name: rule.name }, rule, { upsert: true, new: true });
        }
        console.log('Regras iniciais garantidas no banco de dados.');
    } catch (error) {
        console.error('Erro ao inicializar as regras:', error);
    }
}
// Chame esta função na inicialização:
mongoose.connection.once('open', initializeRules);


// Rota de Cadastro de Usuário
app.post('/api/register', async (req, res) => {
    const { username, password, level } = req.body;
    
    if (!username || !password || !level) {
        return res.status(400).json({ message: 'Faltam dados: username, password e level são obrigatórios.' });
    }

    try {
        const userCount = await User.countDocuments();
        
        // Regra de segurança: Se for o primeiro usuário, pode se cadastrar como Gestão
        if (userCount === 0) {
            const newUser = new User({ username, password, level: 'Gestao' });
            await newUser.save();
            return res.status(201).json({ message: 'Primeiro usuário (Gestão) cadastrado com sucesso.' });
        }
        
        // Se não for o primeiro, é necessário estar logado como 'Gestao' para cadastrar.
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
             return res.status(403).json({ message: 'Cadastro restrito. Faça login primeiro.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.level !== 'Gestao') {
            return res.status(403).json({ message: 'Apenas usuários de Gestão podem cadastrar novos usuários.' });
        }
        
        // Se for Gestão, permite o cadastro
        const newUser = new User({ username, password, level });
        await newUser.save();
        return res.status(201).json({ message: `Usuário ${level} cadastrado com sucesso por Gestão.` });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Nome de usuário já existe.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar.' });
    }
});

// Rota de Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
        return res.status(400).json({ message: 'Usuário não encontrado.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Senha incorreta.' });
    }

    // Cria e assina o token JWT
    const token = jwt.sign({ id: user._id, username: user.username, level: user.level }, JWT_SECRET, { expiresIn: '1h' });

    res.json({
        message: 'Login realizado com sucesso.',
        username: user.username,
        level: user.level,
        token
    });
});

// ==============================
// 5. ROTAS DE REGRAS (PROTEGIDAS)
// ==============================

// Rota para Obter Todas as Regras
app.get('/api/rules', authenticateToken, async (req, res) => {
    try {
        const rules = await Rule.find();
        res.json(rules);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar regras.' });
    }
});

// Rota para Atualizar uma Regra (Permissão: N2 ou Gestao)
app.put('/api/rules/:id', authenticateToken, async (req, res) => {
    // Verifica permissão
    const userLevel = req.user.level;
    if (userLevel !== 'N2' && userLevel !== 'Gestao') {
        return res.status(403).json({ message: 'Permissão negada. Apenas N2 e Gestão podem alterar regras.' });
    }
    
    const { id } = req.params;
    const { state, value } = req.body;

    if (!state || value === undefined) {
        return res.status(400).json({ message: 'Dados incompletos para atualização.' });
    }

    try {
        const updateField = `states.${state}`; // Cria a chave dinâmica para o campo Map
        
        const updatedRule = await Rule.findByIdAndUpdate(
            id,
            { $set: { [updateField]: value } },
            { new: true, runValidators: true }
        );

        if (!updatedRule) {
            return res.status(404).json({ message: 'Regra não encontrada.' });
        }

        res.json({ message: `Regra atualizada com sucesso para ${state}.`, rule: updatedRule });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro interno ao atualizar a regra.' });
    }
});

// Inicializa o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
    console.log(`API acessível em http://localhost:${PORT}/api`);
});

