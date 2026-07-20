"""
client_openai.py

Chat CLI usando GPT-5 + MCP.

Arquitetura:

Usuário
    ↓
GPT-5
    ↓
Servidor MCP
    ↓
REST API

O cliente não conhece a API REST nem as ferramentas.
O modelo descobre as tools do servidor MCP automaticamente.

Requisitos:

export OPENAI_API_KEY=...

Execute:

python client.py
"""

from openai import OpenAI

MODEL = "gpt-5"

client = OpenAI()

SYSTEM_PROMPT = """
Você é um assistente responsável pelo cadastro de usuários.

Converse naturalmente com o usuário.

Quando precisar cadastrar, listar, consultar, atualizar
ou remover usuários, utilize as ferramentas disponíveis
no servidor MCP.

Nunca invente resultados.

Se faltar alguma informação para executar uma ferramenta,
pergunte ao usuário.

Após executar uma ferramenta, explique o resultado de forma
natural para o usuário.
"""

messages = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT,
    }
]

print("=======================================")
print(" Chat MCP")
print(" Digite 'exit' para sair.")
print("=======================================")

while True:

    question = input("\nVocê: ")

    if question.lower() in ("exit", "quit"):
        break

    messages.append(
        {
            "role": "user",
            "content": question,
        }
    )

    response = client.responses.create(
        model=MODEL,
        input=messages,
        tools=[
            {
                "type": "mcp",
                "server_label": "users",
                "server_url": "http://127.0.0.1:8765/mcp",
                "require_approval": "never",
            }
        ],
    )

    answer = response.output_text

    print(f"\nAssistente:\n{answer}")

    messages.append(
        {
            "role": "assistant",
            "content": answer,
        }
    )