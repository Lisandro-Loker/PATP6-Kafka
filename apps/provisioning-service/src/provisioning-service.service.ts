import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  ActivationRequestedPayload,
  EventEnvelope,
  EventType,
  ProvisioningResultPayload,
  TOPICS,
} from '@app/contracts';
import { ProvisioningOrder } from './provisioning-order.schema';

@Injectable()
export class ProvisioningServiceService implements OnModuleInit {
  private readonly logger = new Logger(ProvisioningServiceService.name);

  constructor(
    @InjectModel(ProvisioningOrder.name)
    private readonly orderModel: Model<ProvisioningOrder>,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  // RF-04: Consume ActivationRequested, aplica retardo de 1 a 3 s y publica resultado
  async handleActivationRequested(event: EventEnvelope<ActivationRequestedPayload>) {
    const activationId = event.correlationId;
    const { planId, simulateFailure } = event.payload;

    // Retardo simulado de 1 a 3 segundos (1000 a 3000 ms) según Sección 04
    const delayMs = Math.floor(Math.random() * 2000) + 1000;
    this.logger.log(
      `[${activationId}] Aprovisionando línea para cliente ${event.customerId} (demora simulada: ${delayMs}ms)...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const now = new Date().toISOString();

    // Si se solicitó simular fallo en provisioning
    if (simulateFailure === 'provisioning') {
      await this.orderModel.findOneAndUpdate(
        { activationId },
        {
          activationId,
          customerId: event.customerId,
          planId,
          status: 'FAILED',
          createdAt: now,
        },
        { upsert: true, new: true },
      );

      const failedEvent: EventEnvelope<ProvisioningResultPayload> = {
        eventId: uuidv4(),
        eventType: EventType.PROVISIONING_FAILED,
        version: 1,
        occurredAt: now,
        correlationId: activationId,
        customerId: event.customerId,
        source: 'provisioning-service',
        payload: {
          reason: 'Fallo técnico simulado en aprovisionamiento de línea (simulateFailure=provisioning)',
        },
      };

      this.kafkaClient.emit(TOPICS.PROVISIONING_EVENTS, {
        key: event.customerId,
        value: failedEvent,
      });

      this.logger.warn(
        `[${activationId}] Fallo simulado en provisioning -> Publicado ProvisioningFailed`,
      );
      return;
    }

    // Camino exitoso: guardar orden de aprovisionamiento y publicar ProvisioningCompleted
    const order = await this.orderModel.findOneAndUpdate(
      { activationId },
      {
        activationId,
        customerId: event.customerId,
        planId,
        status: 'COMPLETED',
        createdAt: now,
      },
      { upsert: true, new: true },
    );

    const completedEvent: EventEnvelope<ProvisioningResultPayload> = {
      eventId: uuidv4(),
      eventType: EventType.PROVISIONING_COMPLETED,
      version: 1,
      occurredAt: now,
      correlationId: activationId,
      customerId: event.customerId,
      source: 'provisioning-service',
      payload: {
        orderId: String(order._id),
      },
    };

    this.kafkaClient.emit(TOPICS.PROVISIONING_EVENTS, {
      key: event.customerId,
      value: completedEvent,
    });

    this.logger.log(
      `[${activationId}] Línea aprovisionada OK -> Publicado ProvisioningCompleted`,
    );
  }
}