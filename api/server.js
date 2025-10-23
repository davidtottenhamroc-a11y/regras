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
const PRE_DEFINED_ACCESS_PASSWORD = "otimus32"; 

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

const User = mongoose.model('User', userSchema); 
const Rule = mongoose.model('Rule', ruleSchema);

// =====================================
// --- MIDDLEWARE DE AUTENTICAÇÃO SIMPLIFICADA ---
// =====================================

function authenticateSimplificado(req, res, next) {
    if (!req.headers['x-user-level']) { 
         return res.status(401).json({ message: 'Acesso negado. Informações de sessão não fornecidas.' });
    }
    req.user = { level: req.headers['x-user-level'] }; 
    next();
}

// =====================================
// --- FUNÇÃO DE INICIALIZAÇÃO DE DADOS (COM TODAS AS REGRAS) ---
// =====================================

async function initializeRules() {
    // TODAS AS REGRAS DA PLANILHA CSV FORAM PARSEADAS AQUI
    const initialRules = [
        { name: "Data de Corte teórico", states: { "AL": "01/02/2022", "PE": "01/01/2018", "PB": "abr./ 2013", "CE": "13/07/2017", "RN": "11/09/2017", "GO": "22/01/2018", "SE": "-", "BA": "-", "ES": "-", "MA": "-" } },
        { name: "Data de Corte prático B", states: { "AL": "31/03/2017", "PE": "01/04/2017 / C, D e E 01/08/2022", "PB": "04/07/2017", "CE": "13/08/2017", "RN": "21/12/2018", "GO": "22/01/2018", "SE": "(Em SERGIPE as datas de corte são por regional) Regional Aracaju e Nossa Senhora do Socorro: 02/05/2019 - Regional Própria, Carmópolis e N. S. da Glória: 03/06/2019 - Regional Itabaiana: 17/06/2019 - Regional Estância, Lagarto e Tobias Barreto 01/07/2019", "BA": "15/12/2019", "ES": "-", "MA": "08/05/2023" } },
        { name: "Data de Corte prático A", states: { "AL": "01/09/2021", "PE": "02/01/2020", "PB": "14/02/2022", "CE": "10/02/2025  -  4 Cidades do interior ( Sobral, Maranguape, Iguatu e  Limoeiro) ** \n15/04/2025 -  Demais Cidades do interior de CE  *** \n15/05/2025 - Capital CE-  Fortaleza ", "RN": "26/04/2021", "GO": "*", "SE": "EM IMPLANTAÇÃO", "BA": "24/7/2023", "ES": "-", "MA": "02/10/2024" } },
        { name: "Tipo de pagamento", states: { "AL": "Vsoft/ Conpay", "PE": "REP / CNH Popular", "PB": "Vsoft/ Hab Social", "CE": "Vsoft(conpay) e  Sindgestor ", "RN": "Conpay", "GO": "Vsoft/ Bludata/ Hypersoft", "SE": "REP", "BA": "GerenciaNet", "ES": "REP", "MA": "REP" } },
        { name: "Tipos de sistemas utilizados pelo CFC", states: { "AL": "Prático/ Validador Thomas Greg", "PE": "Teórico / Prático", "PB": "Prático/ iDS CNH/ Validador Biométrico/ Captura", "CE": "Teórico/ Prático", "RN": "Prático / Teórico (SuperAula e CSA)", "GO": "Teórico/ Prático/ Validador biométrico/ Validador Detran (Sistemas Integrados Detran GO)", "SE": "SuperPrático / Capture (validador biométrico) / SuperAula", "BA": "Prático / Captura Biométrica", "ES": "SIT", "MA": "Prático / Teórico / DetranNET" } },
        { name: "Quantidade mínima de aulas emitidas em boleto avulso", states: { "AL": "5", "PE": "2", "PB": "5", "CE": "5", "RN": "5", "GO": "5", "SE": "5", "BA": "5", "ES": "-", "MA": "5" } },
        { name: "Categorias que não precisam de aula noturna", states: { "AL": "Não há mais a obrigatoriedade para aula noturna em nenhuma categoria", "PE": "Nenhuma das categorias se torna obrigatório a realização de aulas noturnas.", "PB": "Não há mais a obrigatoriedade para aula noturna em nenhuma categoria", "CE": "Não há mais a obrigatoriedade para aula noturna em nenhuma categoria", "RN": "Não há mais a obrigatoriedade para aula noturna em nenhuma categoria", "GO": "Não há mais a obrigatoriedade para aula noturna em nenhuma categoria", "SE": "Não precisa de aula noturna em nenhuma categoria", "BA": "-", "ES": "Não precisa de aula noturna em nenhuma categoria", "MA": "Sem obrigatoriedade de aula noturna" } },
        { name: "Aulas simultâneas categoria A", states: { "AL": "-", "PE": "-", "PB": "-", "CE": "Atualmente apenas 2 aulas", "RN": "-", "GO": "-", "SE": "-", "BA": "Atualmente apenas 2 aulas", "ES": "-", "MA": "Atualmente apenas 2 aulas" } },
        { name: "Máximo de aulas seguidas", states: { "AL": "2", "PE": "2", "PB": "3", "CE": "2", "RN": "2", "GO": "2", "SE": "2", "BA": "2", "ES": "1", "MA": "2" } },
        { name: "Máximo de aulas por turno", states: { "AL": "2 Aulas em seguidas, descando de 10 minutos para a 3 aula.", "PE": "Nova regra 01/04/2025\nMáximo de 3 aulas por dia", "PB": "-", "CE": "Nova regra 14/04/2025:\nEx: Turno da manha:  2 aulas de 2 Rodas + Intervalo 50 min + 2 aulas de  4 Rodas\n4 aulas mesmo turno  portanto que entre elas tenha intervalo de 50 minutos obrigatórios.\n>  Após realizar essas 4 aulas ele pode fazer mais  + 1 aula de Moto  🛵 +  1 aula de carro 🚙 - totalizando por dia 6 aulas ", "RN": "3 aulas por categoria (A e B)", "GO": "*", "SE": "3", "BA": "Até 3 da mesma categoria\nEx: 3 de 2R ou 3 de 4R\nAté 3, sendo 1 de categoria distinta.\nEx: 2 de 2R + 1 de 4R e vice-versa\nAté 4, sendo 2 de categoria distinta\nEx: 2 de 2R + 2 de 4R", "ES": "3", "MA": "3" } },
        { name: "Intervalo de tempo entre aulas", states: { "AL": "10 minutos de intervalo, sendo aulas do mesmo candidato, sempre que encerrar e abrir nova aula.", "PE": "- Deve haver no mínimo 30min de intervalo de um bloco de aula para outro.\n\nExemplos: \n- 1ª e 2ª aulas consecutivas em bloco único / intervalo mínimo de 30 minutos / 3ª aula.\n- 1ª aula / intervalo mínimo de 30 minutos / 2ª e 3ª aulas consecutivas em bloco único.\n- 1ª aula / intervalo mínimo de 30 minutos / 2ª aula / intervalo mínimo de 30 minutos / 3ª aula\n\n", "PB": "-", "CE": "Intervalo para iniciar  da 2ª para a 3ª aula -50 minutos", "RN": "50 minutos entre a 1ª e 2ª (caso haja a 3ª) ou 50 minutos entre 2ª e 3ª aula", "GO": "Intervalo para iniciar a 3ª aula - 1h ", "SE": "Entre a 1ª e a 2ª não tem. Entre a 2ª e a 3ª, mínimo de 50 minutos.", "BA": "-", "ES": "Da primeira para segunda aula não precisa de intervalo, da segunda para terceira precisa de um intervalo de 50 minutos.", "MA": "-" } },
        { name: "Tempo minimo regulamentado", states: { "AL": "50 min", "PE": "50 min", "PB": "45 min", "CE": "50 min (5 min tolerância)", "RN": "50 minutos", "GO": "50 min", "SE": "50 min", "BA": "Diurno: 50 min (10min tolerância)\nNoturno: 45 min (10min tolerância)", "ES": "50 min", "MA": "50 min" } },
        { name: "Início do horário noturno", states: { "AL": "17h(Não há obrigatoriedade)", "PE": "17h", "PB": "16h (apenas para processos com data de renach anterior a 12/04/2021)", "CE": "17h ( nao tem mais obrigatoriedade)", "RN": "17h (não há obrigatoriedade)", "GO": "18h às 6h", "SE": "17h (Não ha obrigatoriedade)", "BA": "18H", "ES": "17h", "MA": "17h (Não ha obrigatoriedade de aula noturna)" } },
        { name: "Tolerância entre biometria e SuperPrático", states: { "AL": "-", "PE": "-", "PB": "Simulador: 10 minutos entre biometria e abertura", "CE": "-", "RN": "15 minutos (antes ou depois, no início e no fim da aula)", "GO": "*", "SE": "20 minutos", "BA": "-", "ES": "-", "MA": "-" } },
        { name: "Início e Fim do horário das aulas dias úteis", states: { "AL": "07h - 22h", "PE": "06h - 22h", "PB": "06h - 21h", "CE": "05:00 as 22:50", "RN": "06:00 às 22:00", "GO": "06:00 às 21:00 (Na via pública)", "SE": "06h às 21h50", "BA": "06:00 as 23:00", "ES": "06h - 23h", "MA": "06h - 23h" } },
        { name: "Início / Fim do horário das aulas Sab/Dom e feriado", states: { "AL": "07h - 18h", "PE": "06h - 22h", "PB": "06h - 21h", "CE": "Domingo e feriados não é permitido", "RN": "Sábado: 06:00 às 18:00 // Domingo e feriados não é permitido", "GO": "06:00 às 20:00", "SE": "Sábados seguem o horário normal da semana. Não é permitido ministrar aulas aos domingos.", "BA": "Sábados: das 07h00 às 18h00\nDomingos: das 07h00 às 13h00", "ES": "06h - 23h", "MA": "06h - 23h" } },
        { name: "OBS: ENVIO DE COLETORES", states: { "AL": "-", "PE": "-", "PB": "-", "CE": "CONTRATO 2R COMODATO - 1 APARELHO INSTRUTOR + 1 APARELHO COLETOR", "RN": "-", "GO": "-", "SE": "Contrato 2R COMODATO: 1 aparelho instrutor + 1 aparelho coletor", "BA": "-", "ES": "-", "MA": "-" } },
        { name: "Exigências de conteúdos", states: { "AL": "Parada Estacionamento", "PE": "Conceitos Básicos", "PB": "Parada Estacionamento", "CE": "Conceitos Básicos", "RN": "Parada Estacionamento ( A e B)", "GO": "Conceitos Básicos  Cat  A ( de acordo data corte)  e Cat  B ( todas datas)) ", "SE": "Parada e Estacionamento", "BA": "Conceitos Básicos", "ES": "*", "MA": "Não possui obrigatoriedade/limite de conteúdo" } },
        { name: "Cerco Geográfico - Raio:", states: { "AL": "1000", "PE": "1000", "PB": "500", "CE": "Carro: 500 e Moto  5 km", "RN": "500", "GO": "*", "SE": "-", "BA": "500", "ES": "-", "MA": "-" } },
        // Aulas Práticas (Simplificadas para a tabela principal)
        { name: "PROCESSO INICIAL (VER TABELA DE AULAS)", states: { "AL": "20", "PE": "25", "PB": "25", "CE": "25", "RN": "20", "GO": "25", "SE": "20", "BA": "20", "ES": "20", "MA": "20" } },
        { name: "Processo Adição (VER TABELA DE AULAS)", states: { "AL": "15", "PE": "20", "PB": "20", "CE": "20", "RN": "15", "GO": "20", "SE": "15", "BA": "20", "ES": "15", "MA": "20" } },
        { name: "PRÁTICO TELEMETRIA DIURNA", states: { "AL": "20", "PE": "16", "PB": "19", "CE": "19", "RN": "A critério do CFC", "GO": "19", "SE": "14", "BA": "19", "ES": "20", "MA": "20" } },
        { name: "PRÁTICO TELEMETRIA NOTURNA", states: { "AL": "0", "PE": "4", "PB": "1", "CE": "1", "RN": "A critério do CFC", "GO": "1", "SE": "1", "BA": "1", "ES": "0", "MA": "0" } }
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

// Rotas e Middleware... (Omitidas, pois são as mesmas do bloco anterior)
// ... (app.post('/api/users'), app.post('/api/login'), app.get('/api/rules'), app.put('/api/rules/:id'))

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log('URI do MongoDB:', MONGODB_URI);
});

module.exports = app;
