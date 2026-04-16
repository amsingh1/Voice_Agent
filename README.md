# MARVIN — Voice Agent

A real-time voice AI assistant powered by Azure OpenAI's GPT-4o Realtime API and MCP (Model Context Protocol) tool integration.

## Architecture

```
Voice-Agent/
├── backend/      # Express + WebSocket server (Node.js / TypeScript)
└── frontend/     # React + Vite UI (TypeScript + Tailwind CSS)
```

**Backend** (`port 3002`): Connects the browser to Azure OpenAI Realtime API via WebSocket. Manages sessions, routes audio chunks, integrates MCP tools, and stores conversation memory in SQLite.

**Frontend** (`port 5173`): Browser UI with microphone input, live transcription, tool call display, and conversation history.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- An Azure OpenAI resource with a `gpt-4o-realtime` deployment
- An MCP server running on `localhost:3001` (optional — agent degrades gracefully)

## Setup

1. **Copy the example env file and fill in your credentials:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```env
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
   AZURE_OPENAI_API_KEY=your-api-key-here
   AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
   ```

2. **Install dependencies:**

   ```bash
   # From the Voice-Agent root
   cd backend && pnpm install
   cd ../frontend && pnpm install
   ```

3. **Start the backend:**

   ```bash
   cd backend
   pnpm dev
   ```

4. **Start the frontend (new terminal):**

   ```bash
   cd frontend
   pnpm dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | Your Azure OpenAI resource URL | Yes |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | Yes |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Name of your Realtime deployment | Yes |
| `MCP_SERVER_URL` | URL of your MCP tool server | No (default: `http://localhost:3001/mcp`) |
| `PORT` | Backend port | No (default: `3002`) |
| `FRONTEND_URL` | Frontend origin for CORS | No (default: `http://localhost:5173`) |

> **Never commit `.env` to git.** It is listed in `.gitignore`. Use `.env.example` as a template.

## Security Notes

- API keys must be stored exclusively in `.env` — never hardcoded in source files.
- The `.env` file is gitignored and must not be committed.
- SQLite database files (`data/`, `*.db`, `*.sqlite`) are gitignored — they may contain conversation history.
- Rotate any key immediately if it is accidentally exposed.

## Health Check

```bash
curl http://localhost:3002/health
```

Returns the agent configuration status (without exposing the actual API key).
