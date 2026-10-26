import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ActivationApiModule } from './activation-api.module';

async function bootstrap() {
  const app = await NestFactory.create(ActivationApiModule);
  app.enableCors();

  // Conectar transporte Kafka para consumir billing.events y provisioning.events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env.KAFKA_CLIENT_ID || 'activation-api-consumer',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      },
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID || 'activation-api-group',
      },
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`activation-api corriendo en http://localhost:${port}`);
}
bootstrap();