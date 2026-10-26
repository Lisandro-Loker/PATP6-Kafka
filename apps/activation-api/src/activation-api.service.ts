import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  ActivationFinalPayload,
  ActivationRequestedPayload,
  ActivationStatus,
  EventEnvelope,
  EventType,
  SimulateFailureMode,
  TOPICS,
} from '@app/contracts';
import { Activation } from './activation.schema';
import { ActivationGateway } from './activation.gateway';

@Injectable()
export class ActivationApiService implements OnModuleInit {
  private readonly logger = new Logger(ActivationApiService.name);

  constructor(
    @InjectModel(Activation.name) private readonly activationModel: Model<Activation>,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly gateway: ActivationGateway,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  // RF-01, RF-02 y RF-03: Crear activación en PENDING y publicar ActivationRequested
  async createActivation(dto: {
    customerId: string;
    planId: string;
    simulateFailure?: SimulateFailureMode;
  }) {
    const count = await this.activationModel.countDocuments();
    const activationId = `act-${String(count + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const simulateFailure = dto.simulateFailure || 'none';

    const event: EventEnvelope<ActivationRequestedPayload> = {
      eventId: uuidv4(),
      eventType: EventType.ACTIVATION_REQUESTED,
      version: 1,
      occurredAt: now,
      correlationId: activationId,
      customerId: dto.customerId,
      source: 'activation-api',
      payload: {
        planId: dto.planId,
        channel: 'web',
        simulateFailure,
      },
    };

    const activation = new this.activationModel({
      _id: activationId,
      customerId: dto.customerId,
      planId: dto.planId,
      status: ActivationStatus.PENDING,
      simulateFailure,
      steps: {
        billing: { status: 'PENDING', at: null },
        provisioning: { status: 'PENDING', at: null },
      },
      history: [{ eventType: EventType.ACTIVATION_REQUESTED, at: now }],
      createdAt: now,
      updatedAt: now,
    });

    await activation.save();

    // Publicar en Kafka con clave = customerId (RNF-02)
    this.kafkaClient.emit(TOPICS.ACTIVATION_REQUESTED, {
      key: dto.customerId,
      value: event,
    });

    this.logger.log(`[${activationId}] Activación creada (PENDING) y publicado ActivationRequested`);
    this.gateway.emitTimelineEvent(event, ActivationStatus.PENDING);

    return {
      activationId,
      status: ActivationStatus.PENDING,
    };
  }

  // RF-09: Consultar estado actual e historial de eventos
  async getActivation(id: string) {
    const activation = await this.activationModel.findById(id).lean();
    if (!activation) {
      throw new NotFoundException(`Activación ${id} no encontrada`);
    }
    return activation;
  }

  // Listar las últimas activaciones (útil para la UI)
  async listActivations() {
    return this.activationModel.find().sort({ createdAt: -1 }).limit(20).lean();
  }

  // RF-05 y RF-06: Regla de agregación de resultados de billing y provisioning
  async handleStepEvent(event: EventEnvelope) {
    const activationId = event.correlationId;
    const activation = await this.activationModel.findById(activationId);

    if (!activation) {
      this.logger.warn(`Activación ${activationId} no encontrada para evento ${event.eventType}`);
      return;
    }

    const now = new Date().toISOString();

    // Evitar duplicados en el historial si el mismo tipo de evento ya se registró
    const alreadyInHistory = activation.history.some(
      (h) => h.eventType === event.eventType,
    );
    if (!alreadyInHistory) {
      activation.history.push({ eventType: event.eventType, at: event.occurredAt || now });
    }

    // Si es la confirmación de compensación (BillingAccountCancelled), solo guardamos en historial y emitimos a UI
    if (event.eventType === EventType.BILLING_ACCOUNT_CANCELLED) {
      activation.steps = {
        ...activation.steps,
        billing: { status: 'CANCELLED', at: event.occurredAt || now },
      };
      activation.updatedAt = now;
      activation.markModified('steps');
      activation.markModified('history');
      await activation.save();

      this.logger.log(`[${activationId}] Compensación registrada: BillingAccountCancelled`);
      this.gateway.emitTimelineEvent(event, activation.status);
      return;
    }

    // Regla de agregación (Sección 06): si ya está en ACTIVE o FAILED, ignorar cambios de estado posteriores
    if (
      activation.status === ActivationStatus.ACTIVE ||
      activation.status === ActivationStatus.FAILED
    ) {
      activation.updatedAt = now;
      activation.markModified('history');
      await activation.save();
      this.gateway.emitTimelineEvent(event, activation.status);
      this.logger.log(
        `[${activationId}] Evento ${event.eventType} registrado en historial (activación ya estaba en ${activation.status})`,
      );
      return;
    }

    // Actualizar el paso correspondiente (billing o provisioning)
    const steps = { ...activation.steps };
    let stepFailed = false;

    if (event.eventType === EventType.BILLING_ACCOUNT_CREATED) {
      steps.billing = { status: 'OK', at: event.occurredAt || now };
    } else if (event.eventType === EventType.BILLING_FAILED) {
      steps.billing = { status: 'FAILED', at: event.occurredAt || now };
      stepFailed = true;
    } else if (event.eventType === EventType.PROVISIONING_COMPLETED) {
      steps.provisioning = { status: 'OK', at: event.occurredAt || now };
    } else if (event.eventType === EventType.PROVISIONING_FAILED) {
      steps.provisioning = { status: 'FAILED', at: event.occurredAt || now };
      stepFailed = true;
    }

    activation.steps = steps;
    activation.markModified('steps');

    // Evaluar transición de estado
    if (stepFailed) {
      // Con el primer fallo pasa a FAILED y publica ActivationFailed
      activation.status = ActivationStatus.FAILED;
      const failedEvent = this.buildFinalEvent(
        activation,
        EventType.ACTIVATION_FAILED,
        ActivationStatus.FAILED,
        event.payload?.reason || `Fallo en ${event.source}`,
      );
      activation.history.push({ eventType: EventType.ACTIVATION_FAILED, at: failedEvent.occurredAt });
      activation.updatedAt = now;
      activation.markModified('history');
      await activation.save();

      this.gateway.emitTimelineEvent(event, activation.status);
      this.kafkaClient.emit(TOPICS.ACTIVATION_EVENTS, {
        key: activation.customerId,
        value: failedEvent,
      });
      this.gateway.emitTimelineEvent(failedEvent, activation.status);
      this.logger.warn(`[${activationId}] Activación FAILED -> Publicado ActivationFailed`);
      return;
    }

    // Si ambos pasos están OK, pasa a ACTIVE y publica ActivationCompleted
    if (steps.billing.status === 'OK' && steps.provisioning.status === 'OK') {
      activation.status = ActivationStatus.ACTIVE;
      const completedEvent = this.buildFinalEvent(
        activation,
        EventType.ACTIVATION_COMPLETED,
        ActivationStatus.ACTIVE,
      );
      activation.history.push({
        eventType: EventType.ACTIVATION_COMPLETED,
        at: completedEvent.occurredAt,
      });
      activation.updatedAt = now;
      activation.markModified('history');
      await activation.save();

      this.gateway.emitTimelineEvent(event, ActivationStatus.IN_PROGRESS);
      this.kafkaClient.emit(TOPICS.ACTIVATION_EVENTS, {
        key: activation.customerId,
        value: completedEvent,
      });
      this.gateway.emitTimelineEvent(completedEvent, activation.status);
      this.logger.log(`[${activationId}] Activación ACTIVE -> Publicado ActivationCompleted`);
      return;
    }

    // Si solo llegó el primero y fue OK, pasa a IN_PROGRESS
    activation.status = ActivationStatus.IN_PROGRESS;
    activation.updatedAt = now;
    activation.markModified('history');
    await activation.save();

    this.gateway.emitTimelineEvent(event, activation.status);
    this.logger.log(`[${activationId}] Primer resultado OK (${event.eventType}) -> Estado IN_PROGRESS`);
  }

  private buildFinalEvent(
    activation: Activation,
    eventType: EventType.ACTIVATION_COMPLETED | EventType.ACTIVATION_FAILED,
    status: ActivationStatus.ACTIVE | ActivationStatus.FAILED,
    reason?: string,
  ): EventEnvelope<ActivationFinalPayload> {
    return {
      eventId: uuidv4(),
      eventType,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: activation._id,
      customerId: activation.customerId,
      source: 'activation-api',
      payload: {
        planId: activation.planId,
        status,
        ...(reason ? { reason } : {}),
      },
    };
  }
}