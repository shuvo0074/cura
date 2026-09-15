import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import pinoHttp from 'pino-http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

// Writes to both stdout (still captured by journald under systemd, unchanged
// behavior) and a dedicated file on disk, so the app's own logs survive
// independent of systemd/journald and can be tailed directly.
export const logger = pino(
  { level: process.env.LOG_LEVEL || 'info' },
  pino.multistream([
    { stream: process.stdout },
    { stream: pino.destination({ dest: path.join(logsDir, 'api.log'), mkdir: true, sync: false }) },
  ])
);

// One line per HTTP request/response (method, path, status, response time).
export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
