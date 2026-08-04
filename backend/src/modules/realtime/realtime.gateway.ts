import { Inject, Logger, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AppConfigService } from '../../config/app.config';
import {
  APPOINTMENT_REPOSITORY,
  USER_REPOSITORY,
  type AppointmentRepository,
  type UserRepository,
} from '../../core/ports/repositories';
import { CLOCK, EVENT_BUS, type Clock, type EventBus } from '../../core/ports/services';
import type { AccessTokenClaims } from '../../common/security/jwt-auth.guard';

/**
 * Realtime queue counters.
 *
 * The dashboard's Waiting/Engaged/Done box has to reflect what the front desk
 * is doing without the doctor refreshing. `queue.changed` is published by the
 * appointment and clinical services; this gateway is the transport that
 * delivers it.
 *
 * Security notes:
 *  - The socket authenticates with the same access token as HTTP. An
 *    unauthenticated connection is closed immediately; sockets are not a side
 *    door around the guards.
 *  - Clients are joined to `practice:<id>` rooms only for practices they
 *    actually belong to, so a broadcast cannot leak another clinic's counters.
 *  - Nothing clinical travels over the socket — only counts. A stale or
 *    intercepted frame discloses no patient data.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    // Bridges the in-process domain bus onto the socket transport. Publishers
    // stay unaware that websockets exist.
    this.events.subscribe(async (event) => {
      if (event.type !== 'queue.changed') return;
      await this.broadcastQueue(event.practiceId, event.date);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) return this.reject(client, 'missing_token');

      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.jwt.accessSecret,
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      });

      const user = await this.users.findById(claims.sub);
      if (!user || !user.isActive || user.tokenVersion !== claims.ver) {
        return this.reject(client, 'revoked');
      }

      // Membership is re-read from the database rather than trusted from the
      // token, so a revoked membership cannot keep receiving broadcasts.
      const practiceIds = await this.users.practiceIdsFor(user.id);
      if (practiceIds.length === 0) return this.reject(client, 'no_practice');

      for (const practiceId of practiceIds) {
        await client.join(this.room(practiceId));
      }

      client.data.userId = user.id;
      client.emit('ready', { practiceIds });
    } catch {
      this.reject(client, 'invalid_token');
    }
  }

  handleDisconnect(client: Socket): void {
    void client;
  }

  private async broadcastQueue(practiceId: string, date: string): Promise<void> {
    try {
      const day = new Date(`${date}T00:00:00.000Z`);
      const from = this.clock.startOfDay(day, 'Asia/Dhaka');
      const to = this.clock.endOfDay(day, 'Asia/Dhaka');
      const counts = await this.appointments.countsByStatus(practiceId, from, to);

      this.server.to(this.room(practiceId)).emit('queue.changed', {
        date,
        waiting: counts.WAITING,
        engaged: counts.ENGAGED,
        done: counts.DONE,
        cancelled: counts.CANCELLED + counts.NO_SHOW,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      });
    } catch (error) {
      // A broadcast failure must never surface as a failed HTTP request; the
      // client still has polling as a fallback.
      this.logger.error({ err: error, practiceId }, 'Failed to broadcast queue update');
    }
  }

  private room(practiceId: string): string {
    return `practice:${practiceId}`;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;

    const header = client.handshake.headers.authorization;
    if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
    return null;
  }

  private reject(client: Socket, reason: string): void {
    client.emit('unauthorized', { reason });
    client.disconnect(true);
  }
}
