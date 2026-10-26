import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import {
  ActivationFinalPayload,
  EventEnvelope,
  EventType,
} from '@app/contracts';
import { NotificationRecord } from './notification.schema';

@Injectable()
export class NotificationServiceService {
  private readonly logger = new Logger(NotificationServiceService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(NotificationRecord.name)
    private readonly notificationModel: Model<NotificationRecord>,
  ) {
    // Conexión SMTP hacia Mailhog (puerto 1025 local)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 1025,
      secure: false,
    });
  }

  // RF-07: Envía un email por cada ActivationCompleted o ActivationFailed
  async handleActivationEvent(event: EventEnvelope<ActivationFinalPayload>) {
    if (
      event.eventType !== EventType.ACTIVATION_COMPLETED &&
      event.eventType !== EventType.ACTIVATION_FAILED
    ) {
      return;
    }

    const activationId = event.correlationId;

    // Verificar si ya se envió este email (idempotencia por activationId + eventType)
    const existing = await this.notificationModel.findOne({
      activationId,
      eventType: event.eventType,
    });
    if (existing) {
      this.logger.log(
        `[${activationId}] Email para ${event.eventType} ya fue enviado previamente. Ignorando duplicado.`,
      );
      return;
    }

    const recipient = `${event.customerId.toLowerCase()}@cliente.poc.local`;
    const isSuccess = event.eventType === EventType.ACTIVATION_COMPLETED;

    const subject = isSuccess
      ? `[Bienvenido] Tu plan ${event.payload.planId} ya está ACTIVO (${activationId})`
      : `[Aviso] No pudimos activar tu plan ${event.payload.planId} (${activationId})`;

    const body = isSuccess
      ? `Hola ${event.customerId},\n\n¡Bienvenido! Tu solicitud de activación (${activationId}) para el plan "${event.payload.planId}" se completó con éxito y tu línea ya se encuentra ACTIVA.\n\nGracias por elegirnos.`
      : `Hola ${event.customerId},\n\nLamentablemente ocurrió un inconveniente al procesar tu solicitud (${activationId}) para el plan "${event.payload.planId}".\nMotivo: ${event.payload.reason || 'Error en el aprovisionamiento o facturación'}.\n\nSi se había generado un cargo en tu cuenta, ya fue anulado automáticamente.`;

    await this.transporter.sendMail({
      from: '"Activaciones POC" <no-reply@poc.local>',
      to: recipient,
      subject,
      text: body,
    });

    const now = new Date().toISOString();
    await this.notificationModel.create({
      activationId,
      customerId: event.customerId,
      eventType: event.eventType,
      recipient,
      subject,
      body,
      sentAt: now,
    });

    this.logger.log(
      `[${activationId}] Email enviado a Mailhog (${recipient}) por evento ${event.eventType}`,
    );
  }
}