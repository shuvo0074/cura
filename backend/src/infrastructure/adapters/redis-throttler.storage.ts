import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app.config';

interface ThrottleRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Fixed-window rate-limit counters in Redis, shared by every API instance.
 *
 * If Redis is unreachable requests are let through and the failure is logged: an
 * outage of a cache should not take the clinic's API down with it.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(config: AppConfigService) {
    this.client = new Redis(config.redis.url, { maxRetriesPerRequest: 1 });
    this.client.on('error', (err) => this.logger.error({ err }, 'Redis error'));
  }

  async increment(key: string, ttlMs: number, limit: number): Promise<ThrottleRecord> {
    const redisKey = `throttle:${key}`;
    try {
      const results = await this.client.multi().incr(redisKey).pttl(redisKey).exec();
      const totalHits = Number(results?.[0]?.[1] ?? 0);
      let remainingMs = Number(results?.[1]?.[1] ?? -1);
      if (remainingMs < 0) {
        await this.client.pexpire(redisKey, ttlMs);
        remainingMs = ttlMs;
      }
      const seconds = Math.ceil(remainingMs / 1000);
      const isBlocked = totalHits > limit;
      return { totalHits, timeToExpire: seconds, isBlocked, timeToBlockExpire: isBlocked ? seconds : 0 };
    } catch (err) {
      this.logger.error({ err }, 'Rate limit check skipped');
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
