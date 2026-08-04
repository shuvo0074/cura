import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app.config';
import type {
  Cache,
  Clock,
  DomainEvent,
  EmailMessage,
  EmailSender,
  EventBus,
  IdGenerator,
  SmsMessage,
  SmsSender,
} from '../../core/ports/services';

/** Real clock. Tests substitute a fixed implementation of the same port. */
@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }
  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86_400_000);
  }
  startOfDay(date: Date, timeZone: string): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return new Date(`${parts}T00:00:00.000${this.offsetFor(date, timeZone)}`);
  }
  endOfDay(date: Date, timeZone: string): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return new Date(`${parts}T23:59:59.999${this.offsetFor(date, timeZone)}`);
  }

  /** Resolves a zone's UTC offset as ±HH:MM for the supplied instant. */
  private offsetFor(date: Date, timeZone: string): string {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    });
    const name = dtf.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const match = /GMT([+-]\d{2}:\d{2})/.exec(name);
    return match?.[1] ?? '+00:00';
  }
}

@Injectable()
export class UuidGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }
}

/**
 * Redis-backed cache and coordination primitives.
 *
 * Also backs OTP resend cooldowns and distributed locks, so multiple API
 * instances enforce the same limits rather than each keeping local state.
 */
@Injectable()
export class RedisCache implements Cache {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisCache.name);

  constructor(config: AppConfigService) {
    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    this.client.on('error', (err) => this.logger.error({ err }, 'Redis error'));
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    // Pipelined so the TTL is always applied with the increment.
    const results = await this.client.multi().incr(key).expire(key, ttlSeconds).exec();
    const value = results?.[0]?.[1];
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(`lock:${key}`);
  }
}

/**
 * Development SMS driver.
 *
 * Outside production the full message — including the OTP — is printed, because
 * there is otherwise no way to complete a login locally. `loadEnv` refuses to
 * boot production with this driver selected, so the branch below cannot be
 * reached by a deployed instance; in every other environment the message stays
 * redacted and the code is never written to stdout.
 */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  constructor(private readonly config: AppConfigService) {}

  async send(message: SmsMessage): Promise<{ providerMessageId: string | null }> {
    if (this.config.nodeEnv === 'development' || this.config.nodeEnv === 'test') {
      this.logger.warn(`[DEV ONLY] To ${message.to}: ${message.body}`);
    } else {
      this.logger.debug(
        { to: `${message.to.slice(0, 6)}•••`, bytes: message.body.length, ref: message.reference },
        'SMS dispatched (console driver)',
      );
    }
    return { providerMessageId: `console-${randomUUID()}` };
  }
}

@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger('EMAIL');

  async send(message: EmailMessage): Promise<{ providerMessageId: string | null }> {
    this.logger.debug({ to: message.to, subject: message.subject }, 'Email dispatched (console driver)');
    return { providerMessageId: `console-${randomUUID()}` };
  }
}

/**
 * In-process event bus.
 *
 * Handlers run detached from the request, so a slow SMS gateway cannot extend
 * an HTTP response. A failing handler is logged and isolated rather than
 * propagating into the caller.
 */
@Injectable()
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Set<(e: DomainEvent) => void | Promise<void>>();
  private readonly logger = new Logger(InMemoryEventBus.name);

  publish(event: DomainEvent): void {
    for (const handler of this.handlers) {
      queueMicrotask(() => {
        void Promise.resolve(handler(event)).catch((err) =>
          this.logger.error({ err, type: event.type }, 'Event handler failed'),
        );
      });
    }
  }

  subscribe(handler: (event: DomainEvent) => void | Promise<void>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}
