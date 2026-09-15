import { app } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Cura API listening on http://0.0.0.0:${config.port}`);
});
