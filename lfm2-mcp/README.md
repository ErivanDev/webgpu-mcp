# 🚀 LFM2 MCP

Uma implementação baseada no projeto **LFM2-MCP** da Liquid AI, permitindo executar modelos com suporte a **Model Context Protocol (MCP)** diretamente no navegador utilizando **Transformers.js** e aceleração por **WebGPU**.

> Este repositório é um clone/modificação do projeto original da Liquid AI para fins de estudo, experimentação e customização.

## ✨ Recursos

- 🧠 Execução local do modelo no navegador
- ⚡ Aceleração via WebGPU
- 🔌 Suporte ao Model Context Protocol (MCP)
- 🛠 Tool Calling
- 🌐 Interface web simples
- 🔒 Processamento local (quando suportado pelo navegador)

---

## Tecnologias

- Transformers.js
- WebGPU
- TypeScript
- Vite
- MCP (Model Context Protocol)

---

## Estrutura

```
src/
 ├── components/
 ├── config/
 ├── hooks/
 ├── services/
 ├── tools/
 ├── types/
 └── utils/
```

---

## Executando localmente

Clone o repositório:

```bash
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO
```

Instale as dependências:

```bash
npm install
```

Execute em modo desenvolvimento:

```bash
npm run dev
```

Build para produção:

```bash
npm run build
```

---

## Docker

Construir a imagem:

```bash
docker build -t lfm2-mcp .
```

Executar:

```bash
docker run -p 7860:7860 lfm2-mcp
```

---

## Requisitos

- Navegador compatível com WebGPU
  - Google Chrome
  - Microsoft Edge
- GPU compatível
- Node.js 20+

---

## Objetivo

Este projeto demonstra como executar modelos compatíveis com MCP diretamente no navegador, eliminando a necessidade de chamadas para APIs externas em diversos cenários.

---

## Créditos

Projeto original desenvolvido pela Liquid AI:

https://huggingface.co/spaces/LiquidAI/LFM2-MCP

---

## Licença

Apache 2.0