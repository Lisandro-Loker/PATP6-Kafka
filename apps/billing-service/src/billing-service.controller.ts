import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  ActivationFinalPayload,
  ActivationRequestedPayload,
  EventEnvelope,
  TOPICS,
} from '@app/contracts';
import { KafkaToolkitService } from '@app/kafka-toolkit';
import { BillingServiceService } from './billing-service.service';

@Controller()
export class BillingServiceController {
  private readonly consumerGroup = process.env.KAFKA_GROUP_ID || 'billing-svc';

  constructor(
    private readonly billingService: BillingServiceService,
    private readonly kafkaToolkit: KafkaToolkitService,
  ) {}

  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  async onActivationRequested(
    @Payload() message: EventEnvelope<ActivationRequestedPayload>,
  ) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.ACTIVATION_REQUESTED,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.billingService.handleActivationRequested(message),
    });
  }

  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  async onActivationEvent(
    @Payload() message: EventEnvelope<ActivationFinalPayload>,
  ) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.ACTIVATION_EVENTS,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.billingService.handleActivationEvent(message),
    });
  }
}