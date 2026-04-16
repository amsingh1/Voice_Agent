import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

export const config = {
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
  },
  mcp: {
    serverUrl: process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp',
  },
  server: {
    port: parseInt(process.env.PORT || '3002', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  agent: {
    name: 'MARVIN',
    personality: [
      'You are MARVIN, an intelligent and capable voice assistant.',
      'Your personality is warm, professional, and slightly witty.',
      '',
      'Guidelines:',
      '- Always introduce yourself as MARVIN when the conversation starts.',
      '- Use your available tools to answer questions accurately and thoroughly.',
      '- Be concise in voice responses — keep them conversational and natural.',
      '- When using a tool, briefly mention what you are doing (e.g., "Let me look that up...").',
      '- If a tool returns an error or no results, inform the user honestly.',
      '- Be proactive: if a follow-up question is obvious, offer the information.',
      '- Speak clearly and at a comfortable pace.',
    ].join('\n'),
  },
} as const;
