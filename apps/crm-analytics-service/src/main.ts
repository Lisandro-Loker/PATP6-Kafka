import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CrmAnalyticsServiceModule } from './crm-analytics-service.module';

async function bootstrap() {
  const app = await NestFactory.create(CrmAnalyticsServiceModule);
  app.enableCors();

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env.KAFKA_CLIENT_ID || 'crm-analytics-service',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      },
      consumer: {
        groupId: process.env.KAFKA_GROUP_ID || 'crm-analytics-svc',
        // fromBeginning permite leer también los eventos históricos retenidos en Kafka
        subscribe: { fromBeginning: true },
      },
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 3005;
  await app.listen(port);
  console.log(
    `crm-analytics-service corriendo en http://localhost:${port}/metrics (group: crm-analytics-svc)`,
  );
}
bootstrap();