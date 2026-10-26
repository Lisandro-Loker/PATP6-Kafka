import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ActivationFinalPayload, EventEnvelope, TOPICS } from '@app/contracts';
import { KafkaToolkitService } from '@app/kafka-toolkit';
import { NotificationServiceService } from './notification-service.service';

@Controller()
export class NotificationServiceController {
  private readonly consumerGroup = process.env.KAFKA_GROUP_ID || 'notification-svc';

  constructor(
    private readonly notificationService: NotificationServiceService,
    private readonly kafkaToolkit: KafkaToolkitService,
  ) {}

  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  async onActivationEvent(
    @Payload() message: EventEnvelope<ActivationFinalPayload>,
  ) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.ACTIVATION_EVENTS,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.notificationService.handleActivationEvent(message),
    });
  }
}