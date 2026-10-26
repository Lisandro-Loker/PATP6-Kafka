import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EventEnvelope, type SimulateFailureMode, TOPICS } from '@app/contracts';
import { KafkaToolkitService } from '@app/kafka-toolkit';
import { ActivationApiService } from './activation-api.service';

@Controller('activations')
export class ActivationApiController {
  private readonly consumerGroup = process.env.KAFKA_GROUP_ID || 'activation-api-group';

  constructor(
    private readonly activationApiService: ActivationApiService,
    private readonly kafkaToolkit: KafkaToolkitService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createActivation(
    @Body()
    body: {
      customerId: string;
      planId: string;
      simulateFailure?: SimulateFailureMode;
    },
  ) {
    return this.activationApiService.createActivation(body);
  }

  @Get()
  async listActivations() {
    return this.activationApiService.listActivations();
  }

  @Get(':id')
  async getActivation(@Param('id') id: string) {
    return this.activationApiService.getActivation(id);
  }

  @EventPattern(TOPICS.BILLING_EVENTS)
  async onBillingEvent(@Payload() message: EventEnvelope) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.BILLING_EVENTS,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.activationApiService.handleStepEvent(message),
    });
  }

  @EventPattern(TOPICS.PROVISIONING_EVENTS)
  async onProvisioningEvent(@Payload() message: EventEnvelope) {
    await this.kafkaToolkit.processWithRetryAndDlq({
      topic: TOPICS.PROVISIONING_EVENTS,
      consumerGroup: this.consumerGroup,
      event: message,
      handler: () => this.activationApiService.handleStepEvent(message),
    });
  }
}