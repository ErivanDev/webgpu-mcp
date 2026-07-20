# MCP User Registration Demo

Um exemplo simples de arquitetura MCP usando:

- Cliente Python + Ollama (LLM local)
- Servidor MCP
- API REST (FastAPI)
- CRUD de usuários

O objetivo é mostrar como o MCP funciona como uma camada entre um modelo de IA local e uma API existente, **sem depender de nenhum serviço externo como a OpenAI**.

---

# Arquitetura

```
                Usuário
                    │
                    ▼
          +------------------+
          | Cliente Python   |
          | Ollama (llama3.1)|
          +------------------+
                    │
               MCP Protocol
                    │
                    ▼
          +------------------+
          | Servidor MCP     |
          | FastMCP          |
          +------------------+
                    │
                HTTP REST
                    │
                    ▼
          +------------------+
          | FastAPI CRUD     |
          +------------------+
                    │
                    ▼
            Banco em memória
```

100% local. Nenhuma chamada para APIs externas.

---

# Estrutura

```
.
├── api.py
├── client.py
├── mcp_server.py
├── requirements.txt
└── README.md
```

---

# Pré-requisitos

- Python 3.10+
- [Ollama](https://ollama.com) instalado e em execução localmente
- Modelo `llama3.1` baixado no Ollama

---

# Instalação

Crie um ambiente virtual.

Linux/macOS

```bash
python -m venv .venv
source .venv/bin/activate
```

Windows

```powershell
python -m venv .venv
.venv\Scripts\activate
```

Instale as dependências.

```bash
pip install -r requirements.txt
```

---

# Configurar o Ollama

Instale o Ollama seguindo as instruções em https://ollama.com.

Baixe o modelo usado pelo cliente:

```bash
ollama pull llama3.1
```

Garanta que o serviço do Ollama esteja rodando (por padrão em `http://0.0.0.0:11434`).

Não é necessária nenhuma chave de API (`OPENAI_API_KEY` ou similar) — todo o processamento do modelo ocorre localmente.

---

# Executando

### 1) Inicie a API

```bash
uvicorn api:app --reload --port 8090
```

A API ficará disponível em:

```
http://0.0.0.0:8090
```

---

### 2) Inicie o servidor MCP

```bash
python mcp_server.py
```

O servidor MCP ficará disponível em:

```
http://0.0.0.0:8765/mcp
```

Por padrão, ele se comunica com a API REST em `http://0.0.0.0:8090`. Isso pode ser alterado com a variável de ambiente `API_URL`.

---

### 3) Execute o cliente

```bash
python client.py
```

O cliente conecta ao servidor MCP, carrega as ferramentas disponíveis e inicia um chat interativo no terminal usando o modelo local via Ollama.

---

# Exemplo

Usuário

```
Quero cadastrar uma pessoa
```

Assistente

```
Claro!

Qual é o nome?
```

Usuário

```
João Batista
```

Assistente

```
Qual é a idade?
```

Usuário

```
27
```

O modelo, rodando localmente via Ollama, chamará automaticamente a Tool:

```
create_user(
    name="João Batista",
    age=27
)
```

O servidor MCP fará uma chamada HTTP para:

```
POST /users
```

A API retornará:

```json
{
  "id": 1,
  "name": "João Batista",
  "age": 27
}
```

E o assistente responderá:

```
Usuário cadastrado com sucesso.
```

---

# Endpoints REST

| Método | Endpoint | Descrição |
|---------|----------|-----------|
| GET | /health | Verifica status da API |
| GET | /users | Lista usuários |
| GET | /users/{id} | Busca um usuário |
| POST | /users | Cria um usuário |
| PUT | /users/{id} | Atualiza um usuário |
| DELETE | /users/{id} | Remove um usuário |

---

# Tools MCP

O servidor expõe as seguintes Tools:

- create_user
- list_users
- get_user
- update_user
- delete_user

Essas ferramentas são utilizadas automaticamente pelo modelo (via Ollama) quando necessário, com base na conversa do usuário.

---

# Fluxo

```
Usuário

↓

Ollama (LLM local)

↓

MCP Client

↓

MCP Server

↓

REST API

↓

Resposta

↓

Ollama

↓

Usuário
```

O cliente nunca acessa a API REST diretamente.

O modelo conhece apenas as Tools disponibilizadas pelo servidor MCP.

Essa separação permite trocar a API sem alterar o cliente, trocar o modelo (ou o provedor de LLM) sem alterar a API, e manter todo o fluxo rodando localmente, sem dependência de serviços externos.