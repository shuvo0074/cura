import { availableParallelism } from 'node:os';

/**
 * Process tuning that must happen before anything touches libuv's thread pool,
 * which is why main.ts imports this module first.
 *
 * Password hashing (argon2) and gzip run on that pool, and Node sizes it to
 * 4 threads by default — so no more than 4 logins could hash at once however
 * many cores the host has. Sizing it to the available cores (at least 4) lets
 * concurrent sign-ins use the whole machine. An explicit UV_THREADPOOL_SIZE
 * from the environment still wins.
 */
process.env.UV_THREADPOOL_SIZE ??= String(Math.max(4, availableParallelism()));
