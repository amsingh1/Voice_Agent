import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { config } from './config.js';
import { initMCPClient, closeMCPClient } from './mcp/client.js';
import { initDatabase, closeDatabase } from './memory/store.js';
import { RealtimeSession } from './realtime/session.js';

const app = express();

app.use(
  cors({
    origin: config.server.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    agent: config.agent.name,
    azure: {
      endpoint: config.azure.endpoint,
      deployment: config.azure.deploymentName,
      configured: !!config.azure.apiKey,
    },
    mcp: {
      url: config.mcp.serverUrl,
    },
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const activeSessions = new Map<WebSocket, RealtimeSession>();

wss.on('connection', (ws) => {
  console.log('[WS] Frontend client connected');
  let session: RealtimeSession | null = null;

  ws.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      switch (message.type) {
        case 'session.start': {
          if (session) {
            session.close();
          }
          session = new RealtimeSession(ws);
          activeSessions.set(ws, session);
          await session.start();
          break;
        }

        case 'audio.chunk': {
          if (session && message.data) {
            session.sendAudio(message.data);
          }
          break;
        }

        case 'audio.commit': {
          if (session) {
            session.commitAudio();
          }
          break;
        }

        case 'response.cancel': {
          if (session) {
            session.cancelResponse();
          }
          break;
        }

        case 'session.end': {
          if (session) {
            session.close();
            session = null;
            activeSessions.delete(ws);
          }
          ws.send(JSON.stringify({ type: 'session.ended' }));
          break;
        }

        default:
          console.warn(`[WS] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      const message = (error as Error).message;
      console.error('[WS] Error handling message:', message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message }));
      }
    }
  });

  ws.on('close', () => {
    console.log('[WS] Frontend client disconnected');
    if (session) {
      session.close();
      activeSessions.delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error.message);
  });
});

async function start(): Promise<void> {
  console.log('');
  console.log(`  ╔══════════════════════════════════════╗`);
  console.log(`  ║         MARVIN Voice Agent           ║`);
  console.log(`  ╚══════════════════════════════════════╝`);
  console.log('');

  try {
    await initDatabase();

    await initMCPClient();

    server.listen(config.server.port, () => {
      console.log('');
      console.log(`  [Server]    http://localhost:${config.server.port}`);
      console.log(`  [WebSocket] ws://localhost:${config.server.port}/ws`);
      console.log(`  [Health]    http://localhost:${config.server.port}/health`);
      console.log('');
      console.log(`  Azure: ${config.azure.endpoint}`);
      console.log(`  Model: ${config.azure.deploymentName}`);
      console.log(`  MCP:   ${config.mcp.serverUrl}`);
      console.log('');
      console.log('  Waiting for frontend connections...');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start MARVIN:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('\n  Shutting down MARVIN...');

  for (const [, session] of activeSessions) {
    session.close();
  }
  activeSessions.clear();

  await closeMCPClient();
  closeDatabase();

  server.close(() => {
    console.log('  Goodbye.\n');
    process.exit(0);
  });

  // Force exit after 5s
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
