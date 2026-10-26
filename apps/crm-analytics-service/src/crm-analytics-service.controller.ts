import { Controller, Get } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EventEnvelope, TOPICS } from '@app/contracts';
import { KafkaToolkitService } from '@app/kafka-toolkit';
import { CrmAnalyticsServiceService } from './crm-analytics-service.service';

@Controller()
export class CrmAnalyticsServiceController {
  private readonly consumerGroup = process.env.KAFKA_GROUP_ID || 'crm-analytics-svc';

  constructor(
    private readonly crmService: CrmAnalyticsServiceService,
    private readonly kafkaToolkit: KafkaToolkitService,
  ) {}

  // RF-10: Endpoint HTTP GET /metrics
  @Get('metrics')
  async getMetrics() {
    return this.crmService.getMetrics();
  }

  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  async onActivationRequested(@Payload() message: EventEnvelope) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.ACTIVATION_REQUESTED,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.crmService.recordEvent(message),
    });
  }

  @EventPattern(TOPICS.BILLING_EVENTS)
  async onBillingEvent(@Payload() message: EventEnvelope) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.BILLING_EVENTS,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.crmService.recordEvent(message),
    });
  }

  @EventPattern(TOPICS.PROVISIONING_EVENTS)
  async onProvisioningEvent(@Payload() message: EventEnvelope) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.PROVISIONING_EVENTS,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.crmService.recordEvent(message),
    });
  }

  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  async onActivationEvent(@Payload() message: EventEnvelope) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.ACTIVATION_EVENTS,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.crmService.recordEvent(message),
    });
  }
}