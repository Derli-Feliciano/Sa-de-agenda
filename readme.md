# 🏥 SaúdeAgenda – Sistema de Agendamento Médico

Sistema web de agendamento de consultas médicas desenvolvido como projeto acadêmico.
A aplicação permite cadastrar pacientes, visualizar médicos disponíveis e realizar o agendamento ou cancelamento de consultas.

O sistema utiliza **Google Apps Script como backend** e **Google Sheets como banco de dados**, com comunicação via **API REST** consumida pelo frontend através de requisições `fetch()`.

---

# 📌 Objetivo do Projeto

Desenvolver um sistema simples de **gestão de agendamentos médicos**, permitindo:

* Login de usuários
* Cadastro de pacientes
* Listagem de médicos
* Agendamento de consultas
* Cancelamento de consultas
* Visualização da agenda

O projeto demonstra conceitos de:

* Integração entre frontend e API
* Manipulação de dados em planilhas como banco de dados
* Controle de concorrência
* Estrutura de API REST

---

# 🏗 Arquitetura do Sistema

O sistema segue uma arquitetura simples **Frontend + API + Banco de Dados**.

```
Frontend (HTML + CSS + JavaScript)
        │
        │ fetch()
        ▼
Google Apps Script (API REST)
        │
        ▼
Google Sheets (Banco de dados)
```

### Tecnologias utilizadas

Frontend:

* HTML5
* CSS3
* JavaScript (Vanilla JS)

Backend:

* Google Apps Script

Banco de dados:

* Google Sheets

Integração:

* API REST via HTTP (GET e POST)

---

# 📁 Estrutura do Projeto

```
saudeagenda
│
├── frontend
│   ├── index.html
│   ├── css
│   │   └── style.css
│   └── js
│       └── app.js
│
├── backend
│   └── apps-script.gs
│
└── README.md
```

### Descrição das pastas

**frontend/**
Contém toda a interface do sistema.

**backend/**
Contém o código do backend utilizado no Google Apps Script.

**README.md**
Documentação do projeto.

---

# 🗄 Estrutura do Banco de Dados (Google Sheets)

A planilha utilizada pelo sistema possui as seguintes abas:

### 👨‍⚕️ Medicos

| ID | Nome        | Especialidade |
| -- | ----------- | ------------- |
| 1  | João Silva  | Clínico Geral |
| 2  | Maria Souza | Cardiologista |

---

### 👤 Pacientes

| ID | Nome | CPF | Telefone | Nascimento |
| -- | ---- | --- | -------- | ---------- |

---

### 📅 Agendamentos

| ID | PacienteID | PacienteNome | MedicoID | MedicoNome | Data | Hora | Status |
| -- | ---------- | ------------ | -------- | ---------- | ---- | ---- | ------ |

Status possíveis:

* `Agendada`
* `Cancelada`

---

### 🔐 Usuarios

| ID | Nome | Usuario | Senha | Tipo |
| -- | ---- | ------- | ----- | ---- |

---

# 🔗 API REST

A API é hospedada no **Google Apps Script Web App**.

Exemplo de endpoint:

```
https://script.google.com/macros/s/SEU_DEPLOY/exec
```

---

# 📡 Endpoints da API

## 🔑 Login

```
GET ?action=login
```

Parâmetros:

```
usuario
senha
```

Exemplo:

```
?action=login&usuario=admin&senha=123
```

Resposta:

```
{
  "success": true,
  "message": "Login realizado",
  "data": {
    "nome": "Administrador",
    "tipo": "admin"
  }
}
```

---

## 👨‍⚕️ Listar médicos

```
GET ?action=listarMedicos
```

Retorna todos os médicos cadastrados.

---

## 👤 Listar pacientes

```
GET ?action=listarPacientes
```

Retorna todos os pacientes cadastrados.

---

## 📅 Listar agendamentos

```
GET ?action=listarAgendamentos
```

Retorna todos os agendamentos registrados.

---

## 🕒 Verificar horários ocupados

```
GET ?action=verificarHorariosOcupados
```

Parâmetros:

```
medicoId
data
```

Exemplo:

```
?action=verificarHorariosOcupados&medicoId=1&data=2026-03-11
```

Retorna os horários já ocupados para determinado médico.

---

## ➕ Cadastrar paciente

```
POST
```

Body JSON:

```
{
  "action": "cadastrarPaciente",
  "nome": "João Pereira",
  "cpf": "123.456.789-00",
  "telefone": "(11)99999-9999",
  "nascimento": "1990-05-10"
}
```

---

## 📅 Agendar consulta

```
POST
```

Body:

```
{
  "action": "agendarConsulta",
  "pacienteId": "123",
  "pacienteNome": "João Pereira",
  "medicoId": "1",
  "data": "2026-03-11",
  "hora": "10:00"
}
```

A API verifica automaticamente se o horário já está ocupado.

---

## ❌ Cancelar consulta

```
POST
```

Body:

```
{
  "action": "cancelarConsulta",
  "id": "ID_DA_CONSULTA"
}
```

O status da consulta será atualizado para **Cancelada**.

---

# 🔒 Controle de Concorrência

O sistema utiliza:

```
LockService.getScriptLock()
```

Isso impede que duas requisições simultâneas alterem os dados da planilha ao mesmo tempo.

Esse mecanismo evita problemas como:

* dois agendamentos no mesmo horário
* conflitos de gravação na planilha

---

# ⚙ Funcionamento Interno do Backend

Principais funções do Apps Script:

### `doGet()`

Recebe requisições GET da API.

### `doPost()`

Recebe requisições POST.

### `handleRequest()`

Função central que processa todas as ações da API.

### `getSheetData()`

Lê dados da planilha.

### `addRow()`

Insere novos registros.

### `updateStatus()`

Atualiza status de consultas.

### `login()`

Valida usuário e senha.

### `verificarHorariosOcupados()`

Retorna horários já agendados para um médico em determinada data.

---

# 🧠 Regras de Negócio

O sistema implementa algumas regras:

* Não permite **agendamento duplicado no mesmo horário**
* Consultas podem ser **canceladas**
* Apenas horários disponíveis podem ser selecionados
* Datas passadas não podem ser utilizadas

---

# 🚀 Como Executar o Projeto

### 1️⃣ Criar planilha no Google Sheets

Criar abas:

```
Medicos
Pacientes
Agendamentos
Usuarios
```

---

### 2️⃣ Criar projeto no Google Apps Script

Acessar:

```
https://script.google.com
```

Criar novo projeto e colar o conteúdo de:

```
apps-script.gs
```

---

### 3️⃣ Publicar como Web App

Deploy → **New Deployment**

Tipo:

```
Web App
```

Permissões:

```
Anyone
```

---

### 4️⃣ Copiar URL do deploy

Substituir no frontend:

```
const API_URL = "URL_DO_DEPLOY";
```

---

### 5️⃣ Executar o frontend

Abrir:

```
index.html
```

no navegador.

---

# 👨‍💻 Equipe

Projeto desenvolvido como atividade acadêmica.

Funções no projeto:

Backend:

* Integração com Google Apps Script
* API REST
* Integração com Google Sheets

Frontend:

* Interface do usuário
* Layout e responsividade
* Consumo da API

Integrante	Função
Denise Silva Oliveira	Frontend e Relatórios
Derli da Silva Feliciano	Backend
Felipe Lima Carvalho	Frontend
Henrique Melo Gaertner Amaral	Frontend
José Antônio Soares Galvão	Produção de Vídeo
Kevin de Almeida Giovanelli Sousa	Produção de Vídeo
Luiz Alberto de Souza Benvindo	Backend
Messias Damasceno Jardim	Frontend e Relatórios

---

# 📚 Possíveis Melhorias Futuras

* Autenticação com tokens
* Dashboard administrativo
* Cadastro de médicos via interface
* Filtros por data
* Notificações de consulta
* Integração com banco de dados real (MySQL / PostgreSQL)

---

# 📄 Licença

Projeto desenvolvido apenas para fins educacionais.
