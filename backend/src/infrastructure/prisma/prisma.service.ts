import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../../config/app.config';

/**
 * Prisma client lifecycle.
 *
 * Prisma parameterises every query it builds, which removes SQL injection as a
 * class of bug for all repository code. Raw SQL is used in exactly one place
 * (patient search) and is parameterised explicitly there.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    super({
      datasources: { db: { url: config.database.url } },
      log: config.isProduction
        ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
