const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 

const app = express();

// Configurações
app.use(cors()); 
app.use(express.json());

// =====================================
// --- Variáveis de Ambiente e Secret ---
// =====================================
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://davidtottenhamroc_db_user:David0724.@cluster0.huj6sbw.mongodb.net/?appName=Cluster0";
const PORT = process.env.PORT || 3000; 
const PRE_DEFINED_ACCESS_PASSWORD = "otimus32"; // Senha pré-definida para o primeiro cadastro

// Conexão com o banco de dados MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB!'))
    .catch(err => console.error('Erro de conexão com o MongoDB:', err));

// =====================================
// --- Schemas (Modelos de Dados) ---
// =====================================

const userSchema = new mongoose.Schema({
    login: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    level: { type: String, enum: ['N1', 'N2', 'Gestao'], default: 'N1' }
}, { collection: 'user' }); 

const ruleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    states: { type: Map, of: String }
});

// Outros Schemas (Mantidos do seu código)
const aulaSchema = new mongoose.Schema({ /* ... */ });
const incidenteSchema = new mongoose.Schema({ /* ... */ });
const memorySchema = new mongoose.Schema({ /* ... */ });

// ------------------------------------
// --- Modelos Mongoose ---
// ------------------------------------
const User = mongoose.model('User', userSchema); 
const Rule = mongoose.model('Rule', ruleSchema);
const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);
const Memory = mongoose.model('Memory', memorySchema); 


// =====================================
// --- MIDDLEWARE DE AUTENTICAÇÃO SIMPLIFICADA (NÃO SEGURA) ---
// =====================================

function authenticateSimplificado(req, res, next) {
    // Verifica se o cliente forneceu o nível de acesso no cabeçalho customizado
    if (!req.headers['x-user-level']) { 
         return res.status(401).json({ message: 'Acesso negado. Informações de sessão não fornecidas.' });
    }

    // Adiciona as informações do usuário ao request (para checagem de permissão no PUT)
    req.user = { level: req.headers['x-user-level'] }; 
    next();
}

// =====================================
// --- FUNÇÃO DE INICIALIZAÇÃO DE DADOS ---
// =====================================

async function initializeRules() {
    // **NOTA: Complete esta lista com todas as suas regras**
    const initialRules = [
        { name: "Data de Corte teórico", states: { "AL": "01/02/2022", "PE": "01/01/2018", "PB": "abr./ 2013", "CE": "13/07/2017", "RN": "11/09/2017", "GO": "22/01/2018", "SE": "-", "BA": "-", "ES": "-", "MA": "-" } },
        { name: "Data de Corte prático B", states: { "AL": "31/03/2017", "PE": "01/04/2017 / C, D e E 01/08/2022", "PB": "04/07/2017", "CE": "13/08/2017", "RN": "21/12/2018", "GO": "22/01/2018", "SE": "(Em SERGIPE as datas de corte são por regional)", "BA": "15/12/2019", "ES": "-", "MA": "08/05/2023" } },
        { name: "Tempo minimo regulamentado", states: { "AL": "50 min", "PE": "50 min", "PB": "45 min", "CE": "50 min (5 min tolerância)", "RN": "50 minutos", "GO": "50 min", "SE": "50 min", "BA": "Diurno: 50 min", "ES": "50 min", "MA": "50 min" } },
        { name: "Tipo de pagamento", states: { "AL": "Vsoft/ Conpay", "PE": "REP / CNH Popular", "PB": "Vsoft/ Hab Social", "CE": "Vsoft(conpay) e Sindgestor", "RN": "Conpay", "GO": "Vsoft/ Bludata/ Hypersoft", "SE": "REP", "BA": "GerenciaNet", "ES": "REP", "MA": "REP" } },
        { name: "PROCESSO INICIAL (VER TABELA DE AULAS)", states: { "AL": "VER TABELA DE AULAS", "PE": "VER TABELA DE AULAS", "PB": "VER TABELA DE AULAS", "CE": "VER TABELA DE AULAS", "RN": "VER TABELA DE AULAS", "GO": "VER TABELA DE AULAS", "SE": "VER TABELA DE AULAS", "BA": "VER TABELA DE AULAS", "ES": "VER TABELA DE AULAS", "MA": "VER TABELA DE AULAS" } }
        // ... (Insira o restante dos seus dados aqui)
    ];

    try {
        for (const rule of initialRules) {
            await Rule.findOneAndUpdate({ name: rule.name }, rule, { upsert: true, new: true });
        }
        console.log('Regras iniciais garantidas no banco de dados.');
    } catch (error) {
        console.error('Erro ao inicializar as regras:', error);
    }
}
mongoose.connection.once('open', initializeRules);

// =====================================
// --- Rotas da API (Autenticação e Usuários) ---
// =====================================

// Rota para criar um novo usuário
app.post('/api/users', async (req, res) => {
    try {
        const { login, senha, level, accessPassword } = req.body; 

        if (!accessPassword || accessPassword !== PRE_DEFINED_ACCESS_PASSWORD) {
            return res.status(403).send({ message: "Acesso negado. Senha de acesso incorreta para cadastrar usuário." });
        }
        
        if (!login || !senha || !level) {
            return res.status(400).send({ message: "Login, senha e Nível (N1, N2 ou Gestao) são obrigatórios." });
        }
        
        const hashedPassword = await bcrypt.hash(senha, 10); 
        
        const novoUsuario = new User({ login, senha: hashedPassword, level });
        
        await novoUsuario.save();
        
        novoUsuario.senha = undefined; 
        res.status(201).send(novoUsuario);

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send({ message: "Este login já está em uso." });
        }
        res.status(400).send({ message: "Erro ao criar usuário.", error: error.message });
    }
});

// Rota de Login (SEM JWT)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ login: username });

        if (!user) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas.' });
        }
        
        const isMatch = await bcrypt.compare(password, user.senha);
        
        if (!isMatch) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas.' });
        }

        // Retorna o nível de acesso e o nome do usuário (Será salvo no localStorage do cliente)
        res.json({ 
            authenticated: true, 
            message: 'Login bem-sucedido.',
            level: user.level,
            username: user.login
        });

    } catch (error) {
        console.error('Erro durante a autenticação:', error);
        res.status(500).json({ authenticated: false, message: 'Erro interno do servidor.' });
    }
});

// =====================================
// --- Rotas de Regras (PROTEGIDAS PELA SESSÃO SIMPLIFICADA) ---
// =====================================

// Rota para Obter Todas as Regras (Requer Login)
app.get('/api/rules', authenticateSimplificado, async (req, res) => {
    try {
        const rules = await Rule.find({});
        res.send(rules);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar regras.' });
    }
});

// Rota para Atualizar uma Regra (Permissão: N2 ou Gestao)
app.put('/api/rules/:id', authenticateSimplificado, async (req, res) => {
    // 1. Verifica Permissão baseada no header 'X-User-Level'
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
        const updateField = `states.${state}`; 
        
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


// =====================================
// --- Outras Rotas (Mantidas do seu código) ---
// =====================================

// --- Rotas de Aulas ---
app.post('/api/aulas', async (req, res) => { /* ... */ });
app.get('/api/aulas', async (req, res) => { /* ... */ });

// --- Rotas de Incidentes ---
app.post('/api/incidentes', async (req, res) => { /* ... */ });
app.get('/api/incidentes', async (req, res) => { /* ... */ });
app.delete('/api/incidentes/:id', async (req, res) => { /* ... */ });

// --- ROTAS PARA MEMÓRIA DO CHATBOT ---
app.post('/api/memories', async (req, res) => { /* ... */ });
app.get('/api/memories', async (req, res) => { /* ... */ });


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log('URI do MongoDB:', MONGODB_URI);
});

module.exports = app;
