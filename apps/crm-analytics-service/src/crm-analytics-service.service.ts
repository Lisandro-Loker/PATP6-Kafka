import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEnvelope, EventType } from '@app/contracts';
import { MetricDocument } from './metric.schema';

@Injectable()
export class CrmAnalyticsServiceService {
  private readonly logger = new Logger(CrmAnalyticsServiceService.name);

  constructor(
    @InjectModel(MetricDocument.name)
    private readonly metricModel: Model<MetricDocument>,
  ) {}

  async recordEvent(event: EventEnvelope) {
    const now = new Date().toISOString();
    const incFields: Record<string, number> = {
      [`eventsByType.${event.eventType}`]: 1,
    };

    if (event.eventType === EventType.ACTIVATION_REQUESTED) {
      incFields.totalRequested = 1;
      const planId = event.payload?.planId || 'Sin Plan';
      // Reemplazamos puntos si hubiera para evitar sub-objetos en MongoDB
      const safePlanKey = String(planId).replace(/\./g, '_');
      incFields[`byPlan.${safePlanKey}`] = 1;
    } else if (event.eventType === EventType.ACTIVATION_COMPLETED) {
      incFields.totalCompleted = 1;
    } else if (event.eventType === EventType.ACTIVATION_FAILED) {
      incFields.totalFailed = 1;
    } else if (event.eventType === EventType.BILLING_ACCOUNT_CANCELLED) {
      incFields.totalCompensated = 1;
    }

    await this.metricModel.findOneAndUpdate(
      { _id: 'global' },
      {
        $inc: incFields,$set: { updatedAt: now },
      },
      { upsert: true, new: true },
    );

    this.logger.log(
      `[CRM Métricas] Contabilizado ${event.eventType} (correlationId: ${event.correlationId})`,
    );
  }

  // RF-10: Devuelve las métricas consolidadas en tiempo real
  async getMetrics() {
    const doc = await this.metricModel.findById('global').lean();
    if (!doc) {
      return {
        totalRequested: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalCompensated: 0,
        byPlan: {},
        eventsByType: {},
        updatedAt: null,
      };
    }
    return doc;
  }
}