// VARIÁVEIS GLOBAIS
let currentUser = null;
let currentLevel = null;
const tableBody = document.getElementById('table-body');
const tableHeader = document.getElementById('table-header');
const mainSystem = document.getElementById('main-system');
const loginScreen = document.getElementById('login-screen');
const registerScreen = document.getElementById('register-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const logoutButton = document.getElementById('logout-button');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');
const statusMessage = document.getElementById('status-message');

// --- 1. FUNÇÕES DE AUTENTICAÇÃO E PERMISSÃO ---

function updateAuthDisplay() {
    if (currentUser && currentLevel) {
        loginScreen.classList.add('hidden');
        registerScreen.classList.add('hidden');
        mainSystem.classList.remove('hidden');
        document.getElementById('current-user').textContent = currentUser;
        document.getElementById('current-level').textContent = currentLevel;
        renderRulesTable(); // Renderiza a tabela após o login
    } else {
        loginScreen.classList.remove('hidden');
        registerScreen.classList.add('hidden');
        mainSystem.classList.add('hidden');
    }
}

function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    loginMessage.classList.add('hidden');

    if (USERS[username] && USERS[username].password === password) {
        currentUser = username;
        currentLevel = USERS[username].level;
        updateAuthDisplay();
    } else {
        loginMessage.textContent = 'Usuário ou senha inválidos.';
        loginMessage.classList.remove('hidden');
    }
}

function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const level = document.getElementById('reg-level').value;

    registerMessage.classList.add('hidden');

    if (USERS[username]) {
        registerMessage.textContent = 'Usuário já existe. Tente outro.';
        registerMessage.classList.remove('hidden');
        return;
    }

    if (username && password) {
        USERS[username] = { password, level };
        saveData(); // Salva o novo usuário
        registerForm.reset();
        
        registerMessage.textContent = `Usuário ${username} (${level}) cadastrado com sucesso!`;
        registerMessage.classList.remove('hidden');
        registerMessage.classList.replace('error', 'success');
        
        // Volta para a tela de login
        setTimeout(() => {
            document.getElementById('show-login').click();
            registerMessage.classList.add('hidden');
        }, 2000);
    }
}

function handleLogout() {
    currentUser = null;
    currentLevel = null;
    updateAuthDisplay();
    loginForm.reset();
}

// --- 2. FUNÇÕES DE RENDERIZAÇÃO E EDIÇÃO DA TABELA ---

function renderRulesTable() {
    // 1. Renderiza o cabeçalho (Estados)
    tableHeader.innerHTML = '';
    STATES.forEach(state => {
        const th = document.createElement('th');
        th.textContent = state;
        tableHeader.appendChild(th);
    });

    // 2. Renderiza o corpo da tabela
    tableBody.innerHTML = '';
    const isEditable = currentLevel === 'N2' || currentLevel === 'Gestao';
    
    // Filtra as colunas que o N1 pode ver se o nível for N1
    const allowedStates = (currentLevel === 'N1') ? STATES.filter(s => s === 'DADOS DA REGRA' || s === 'PE') : STATES;

    Object.keys(RULES_DATA).forEach(ruleName => {
        const tr = document.createElement('tr');
        
        allowedStates.forEach(state => {
            const td = document.createElement('td');
            
            if (state === 'DADOS DA REGRA') {
                td.textContent = ruleName;
                td.style.fontWeight = 'bold';
            } else {
                const cellValue = RULES_DATA[ruleName][state] || '-';
                td.textContent = cellValue;
                
                // Aplica a lógica de permissão de visualização para N1
                // N1 só pode ver a regra (primeira coluna) e PE (Pernambuco)
                if (currentLevel === 'N1' && state !== 'PE') {
                    // Células de outros estados para N1 (apenas no protótipo, mas o allowedStates já filtra a renderização)
                } else {
                    // Células editáveis (N2 e Gestão)
                    if (isEditable) {
                        td.classList.add('rule-cell');
                        td.dataset.rule = ruleName;
                        td.dataset.state = state;
                        td.addEventListener('click', handleCellClick);
                    }
                }
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });

    // Se N1, esconde a tabela caso não tenha permissão de visualização, mas a lógica acima já filtrou.
}

function handleCellClick(event) {
    const td = event.target;
    const ruleName = td.dataset.rule;
    const state = td.dataset.state;
    const originalValue = td.textContent;

    // Se o usuário já estiver editando, não faz nada
    if (td.querySelector('textarea')) return;

    // Cria o campo de edição (textarea)
    const textarea = document.createElement('textarea');
    textarea.value = originalValue;
    textarea.style.width = '100%';
    textarea.style.minHeight = '50px';
    textarea.style.boxSizing = 'border-box';

    // Cria o botão de salvar
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Salvar';
    saveButton.style.marginTop = '5px';
    saveButton.style.display = 'block';

    // Cria o botão de cancelar
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.style.marginTop = '5px';
    cancelButton.style.marginLeft = '5px';
    cancelButton.style.backgroundColor = '#6c757d'; // Cinza

    // Função para finalizar a edição
    const finalizeEdit = (newValue = originalValue) => {
        td.textContent = newValue;
        td.appendChild(saveButton); // Remove botões e textarea
        td.removeChild(textarea);
        td.removeChild(saveButton);
        td.removeChild(cancelButton);
        td.addEventListener('click', handleCellClick); // Reativa o clique
    };

    // Lógica de SALVAR
    saveButton.addEventListener('click', () => {
        const newValue = textarea.value.trim();
        
        // Atualiza a estrutura de dados (RULES_DATA)
        RULES_DATA[ruleName][state] = newValue;
        saveData(); // Salva no localStorage

        // Atualiza a célula e finaliza a edição
        finalizeEdit(newValue);
        
        // Feedback de sucesso
        statusMessage.textContent = `Regra de ${ruleName} em ${state} atualizada por ${currentUser} (${currentLevel}).`;
        statusMessage.classList.remove('hidden', 'error');
        statusMessage.classList.add('success');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    });
    
    // Lógica de CANCELAR
    cancelButton.addEventListener('click', () => {
        finalizeEdit(originalValue);
    });


    // Substitui o conteúdo da célula pelos campos de edição
    td.textContent = '';
    td.removeEventListener('click', handleCellClick);
    td.appendChild(textarea);
    td.appendChild(saveButton);
    td.appendChild(cancelButton);
    textarea.focus();
}

// --- 3. EVENT LISTENERS E INICIALIZAÇÃO ---

document.addEventListener('DOMContentLoaded', () => {
    loadData(); // Carrega dados e usuários do localStorage
    updateAuthDisplay();
});

// Switch entre Login e Cadastro
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginScreen.classList.add('hidden');
    registerScreen.classList.remove('hidden');
    loginMessage.classList.add('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    registerMessage.classList.add('hidden');
});


// Login e Logout
loginForm.addEventListener('submit', handleLogin);
logoutButton.addEventListener('click', handleLogout);
registerForm.addEventListener('submit', handleRegister);