import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  ActivationFinalPayload,
  ActivationRequestedPayload,
  BillingResultPayload,
  EventEnvelope,
  EventType,
  TOPICS,
} from '@app/contracts';
import { BillingAccount } from './billing-account.schema';

@Injectable()
export class BillingServiceService implements OnModuleInit {
  private readonly logger = new Logger(BillingServiceService.name);
  // Registro para el caso borde: si ActivationFailed llega antes de terminar de crear la cuenta
  private readonly failedActivations = new Set<string>();

  constructor(
    @InjectModel(BillingAccount.name)
    private readonly billingModel: Model<BillingAccount>,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  // RF-04: Procesa ActivationRequested y publica BillingAccountCreated o BillingFailed
  async handleActivationRequested(event: EventEnvelope<ActivationRequestedPayload>) {
    const activationId = event.correlationId;
    const { planId, simulateFailure } = event.payload;

    // Si la demo pidió simular un fallo de negocio en billing (no va a DLQ, publica BillingFailed)
    if (simulateFailure === 'billing') {
      const failedEvent: EventEnvelope<BillingResultPayload> = {
        eventId: uuidv4(),
        eventType: EventType.BILLING_FAILED,
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: activationId,
        customerId: event.customerId,
        source: 'billing-service',
        payload: {
          reason: 'Fallo simulado en facturación (simulateFailure=billing)',
        },
      };

      this.kafkaClient.emit(TOPICS.BILLING_EVENTS, {
        key: event.customerId,
        value: failedEvent,
      });

      this.logger.warn(`[${activationId}] Fallo simulado en billing -> Publicado BillingFailed`);
      return;
    }

    const now = new Date().toISOString();

    // Crear cuenta con estado CREATED (idempotente por activationId)
    let account = await this.billingModel.findOne({ activationId });
    if (!account) {
      account = new this.billingModel({
        activationId,
        customerId: event.customerId,
        planId,
        status: 'CREATED',
        createdAt: now,
        updatedAt: now,
      });
      await account.save();
    }

    const createdEvent: EventEnvelope<BillingResultPayload> = {
      eventId: uuidv4(),
      eventType: EventType.BILLING_ACCOUNT_CREATED,
      version: 1,
      occurredAt: now,
      correlationId: activationId,
      customerId: event.customerId,
      source: 'billing-service',
      payload: {
        accountId: String(account._id),
      },
    };

    this.kafkaClient.emit(TOPICS.BILLING_EVENTS, {
      key: event.customerId,
      value: createdEvent,
    });

    this.logger.log(`[${activationId}] Cuenta CREATED -> Publicado BillingAccountCreated`);

    // Caso borde (Sección 06): si ActivationFailed había llegado antes de que termináramos de crear la cuenta, la anulamos ahora
    if (this.failedActivations.has(activationId)) {
      this.logger.warn(
        `[${activationId}] Caso borde detectado: ActivationFailed se recibió antes de terminar. Anulando cuenta...`,
      );
      await this.cancelAccountIfCreated(activationId, event.customerId);
    }
  }

  // RF-06: Consume ActivationFailed para anular la cuenta (compensación)
  async handleActivationEvent(event: EventEnvelope<ActivationFinalPayload>) {
    if (event.eventType !== EventType.ACTIVATION_FAILED) {
      return;
    }

    const activationId = event.correlationId;
    this.failedActivations.add(activationId);

    await this.cancelAccountIfCreated(activationId, event.customerId);
  }

  private async cancelAccountIfCreated(activationId: string, customerId: string) {
    const account = await this.billingModel.findOne({ activationId });

    // Solo compensa si la cuenta fue creada y aún no está CANCELLED
    if (!account || account.status === 'CANCELLED') {
      return;
    }

    const now = new Date().toISOString();
    account.status = 'CANCELLED';
    account.updatedAt = now;
    await account.save();

    const cancelledEvent: EventEnvelope<BillingResultPayload> = {
      eventId: uuidv4(),
      eventType: EventType.BILLING_ACCOUNT_CANCELLED,
      version: 1,
      occurredAt: now,
      correlationId: activationId,
      customerId,
      source: 'billing-service',
      payload: {
        accountId: String(account._id),
        reason: 'Compensación por ActivationFailed',
      },
    };

    this.kafkaClient.emit(TOPICS.BILLING_EVENTS, {
      key: customerId,
      value: cancelledEvent,
    });

    this.logger.warn(
      `[${activationId}] Compensación aplicada: Cuenta CANCELLED -> Publicado BillingAccountCancelled`,
    );
  }
}