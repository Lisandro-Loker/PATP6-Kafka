import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { Model } from 'mongoose';
import { EventEnvelope, getDlqTopic } from '@app/contracts';
import { ProcessedEvent } from './processed-event.schema';

@Injectable()
export class KafkaToolkitService implements OnModuleInit {
  private readonly logger = new Logger(KafkaToolkitService.name);
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 500;

  constructor(
    @InjectModel(ProcessedEvent.name)
    private readonly processedEventModel: Model<ProcessedEvent>,
    @Inject('TOOLKIT_KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async processWithRetryAndDlq<T = any>(params: {
    topic: string;
    consumerGroup: string;
    event: EventEnvelope<T>;
    handler: () => Promise<void>;
  }): Promise<void> {
    const { topic, consumerGroup, event, handler } = params;

    // 1. Si el evento ya tiene eventId, verificar idempotencia antes de ejecutar nada
    if (event && typeof event === 'object' && event.eventId) {
      const alreadyProcessed = await this.processedEventModel.findOne({
        eventId: event.eventId,
        consumerGroup,
      });

      if (alreadyProcessed) {
        this.logger.warn(
          `[Idempotencia] Evento duplicado ignorado: eventId=${event.eventId} ya fue procesado por ${consumerGroup}`,
        );
        return;
      }
    }

    // 2. Ejecutar el handler con hasta 3 reintentos y backoff exponencial
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        attempt++;

        // Validar que el sobre común (envelope) tenga los campos obligatorios
        this.validateEnvelope(event);

        // Ejecutar la lógica de negocio del microservicio
        await handler();

        // 3. Registrar en processed_events para garantizar idempotencia futura
        await this.markAsProcessed(event.eventId, consumerGroup, event.eventType);
        return;
      } catch (error: any) {
        const errorMsg = error?.message || 'Error desconocido al procesar evento';
        const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms

        this.logger.warn(
          `[${consumerGroup}] Intento ${attempt}/${this.maxRetries} fallido en topic "${topic}": ${errorMsg}`,
        );

        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          // 4. Agotados los reintentos -> Enviar a <topic>.dlq con los headers requeridos
          await this.sendToDlq(topic, event, errorMsg, attempt);
        }
      }
    }
  }

  private validateEnvelope(event: any) {
    if (!event || typeof event !== 'object') {
      throw new Error('Mensaje inválido: el payload no es un objeto JSON válido');
    }
    if (!event.eventId || !event.eventType || !event.correlationId || !event.customerId) {
      throw new Error(
        'Mensaje inválido: faltan campos obligatorios del sobre común (eventId, eventType, correlationId o customerId)',
      );
    }
  }

  private async markAsProcessed(
    eventId: string,
    consumerGroup: string,
    eventType: string,
  ) {
    try {
      await this.processedEventModel.create({
        eventId,
        consumerGroup,
        eventType,
        processedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      // Código 11000 en MongoDB = clave duplicada (otro hilo lo insertó justo antes)
      if (err?.code !== 11000) {
        throw err;
      }
    }
  }

  private async sendToDlq(
    originalTopic: string,
    event: any,
    errorMessage: string,
    retryCount: number,
  ) {
    const dlqTopic = getDlqTopic(originalTopic);
    const failedAt = new Date().toISOString();
    const key = event?.customerId || event?.correlationId || 'unknown-key';

    this.kafkaClient.emit(dlqTopic, {
      key,
      value: event,
      headers: {
        'x-original-topic': originalTopic,
        'x-error-message': errorMessage,
        'x-retry-count': String(retryCount),
        'x-failed-at': failedAt,
      },
    });

    this.logger.error(
      `[DLQ] Mensaje enviado a "${dlqTopic}" tras ${retryCount} intentos fallidos. Motivo: ${errorMessage}`,
    );
  }
}