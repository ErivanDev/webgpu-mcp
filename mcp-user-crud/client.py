"""
client.py

Chat CLI usando Ollama + MCP.

Arquitetura:

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
FastAPI

Sem OpenAI API.
100% local.

Executar:

python client.py
"""

from __future__ import annotations

import asyncio
import json

import ollama

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


MODEL = "llama3.1"

SYSTEM_PROMPT = """
Você é um assistente responsável pelo cadastro de usuários.

Você possui ferramentas para:

- cadastrar usuários
- listar usuários
- consultar usuários
- atualizar usuários
- remover usuários

Sempre converse naturalmente.

Quando precisar executar uma ação,
use uma ferramenta disponível.

Nunca invente dados.

Se faltar informação,
pergunte ao usuário.
"""

async def main():
    async with streamablehttp_client(
        "http://0.0.0.0:8765/mcp"
    ) as (read, write, _):
        async with ClientSession(
            read,
            write
        ) as session:
            await session.initialize()

            #
            # Carrega ferramentas MCP
            #
            mcp_tools = await session.list_tools()

            tools = []

            for tool in mcp_tools.tools:
                tools.append(
                    {
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": tool.inputSchema,
                        },
                    }
                )

            print("==============================")
            print(" Chat MCP + Ollama")
            print(" Digite exit para sair")
            print("==============================")

            print("\nFerramentas MCP:")
            for tool in tools:
                print(
                    "-",
                    tool["function"]["name"]
                )

            messages = [
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                }
            ]

            while True:
                question = input(
                    "\nVocê: "
                )

                if question.lower() in (
                    "exit",
                    "quit",
                ):
                    break

                messages.append(
                    {
                        "role": "user",
                        "content": question,
                    }
                )

                #
                # Loop de tool calling
                #
                while True:
                    response = ollama.chat(
                        model=MODEL,
                        messages=messages,
                        tools=tools,
                    )

                    message = response["message"]

                    #
                    # Sem chamada de ferramenta
                    #
                    if not message.get("tool_calls"):
                        print(
                            "\nAssistente:"
                        )

                        print(
                            message["content"]
                        )

                        messages.append(
                            {
                                "role": "assistant",
                                "content": message["content"],
                            }
                        )
                        break

                    #
                    # Executa ferramentas MCP
                    #
                    messages.append(
                        {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": message["tool_calls"],
                        }
                    )

                    for call in message["tool_calls"]:
                        name = (
                            call["function"]["name"]
                        )

                        arguments = (
                            call["function"]["arguments"]
                        )

                        print(
                            f"\nExecutando MCP tool: {name}"
                        )

                        result = await session.call_tool(
                            name,
                            arguments,
                        )

                        output = []

                        for item in result.content:
                            if item.type == "text":
                                output.append(
                                    item.text
                                )

                        tool_result = "\n".join(
                            output
                        )

                        messages.append(
                            {
                                "role": "tool",
                                "content": tool_result,
                            }
                        )


if __name__ == "__main__":
    asyncio.run(main())