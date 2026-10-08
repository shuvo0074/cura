import { app } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { pool } from './db.js';
import { runMigrations } from './db/migrate.js';

// Bring the database schema up to date before serving, so a deploy that adds
// columns can't leave endpoints querying columns that don't exist yet. If it
// fails, keep serving: most endpoints don't depend on the newest columns.
try {
  await runMigrations(pool);
  logger.info('Database schema is up to date');
} catch (err) {
  logger.error({ err }, 'Applying the database schema failed');
}

app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Cura API listening on http://0.0.0.0:${config.port}`);
});
