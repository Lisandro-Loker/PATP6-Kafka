import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BillingServiceModule } from './billing-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    BillingServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: process.env.KAFKA_CLIENT_ID || 'billing-service',
          brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        },
        consumer: {
          groupId: process.env.KAFKA_GROUP_ID || 'billing-svc',
        },
      },
    },
  );

  await app.listen();
  console.log('billing-service escuchando eventos en Kafka (group: billing-svc)');
}
bootstrap();