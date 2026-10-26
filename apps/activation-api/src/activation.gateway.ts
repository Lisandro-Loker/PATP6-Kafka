import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventEnvelope } from '@app/contracts';

@WebSocketGateway({ cors: { origin: '*' } })
export class ActivationGateway {
  @WebSocketServer()
  server: Server;

  emitTimelineEvent(event: EventEnvelope, activationStatus: string) {
    if (this.server) {
      this.server.emit('activation.event', {
        activationId: event.correlationId,
        activationStatus,
        event,
      });
    }
  }
}