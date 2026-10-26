import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ActivationRequestedPayload, EventEnvelope, TOPICS } from '@app/contracts';
import { KafkaToolkitService } from '@app/kafka-toolkit';
import { ProvisioningServiceService } from './provisioning-service.service';

@Controller()
export class ProvisioningServiceController {
  private readonly consumerGroup = process.env.KAFKA_GROUP_ID || 'provisioning-svc';

  constructor(
    private readonly provisioningService: ProvisioningServiceService,
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
      handler: () => this.provisioningService.handleActivationRequested(message),
    });
  }
}