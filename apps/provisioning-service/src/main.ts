import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ProvisioningServiceModule } from './provisioning-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ProvisioningServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: process.env.KAFKA_CLIENT_ID || 'provisioning-service',
          brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        },
        consumer: {
          groupId: process.env.KAFKA_GROUP_ID || 'provisioning-svc',
        },
      },
    },
  );

  await app.listen();
  console.log('provisioning-service escuchando eventos en Kafka (group: provisioning-svc)');
}
bootstrap();