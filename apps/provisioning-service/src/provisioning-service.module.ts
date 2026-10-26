import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaToolkitModule } from '@app/kafka-toolkit';
import { ProvisioningServiceController } from './provisioning-service.controller';
import { ProvisioningServiceService } from './provisioning-service.service';
import { ProvisioningOrder, ProvisioningOrderSchema } from './provisioning-order.schema';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI ||
        'mongodb://127.0.0.1:27017/provisioning_service?directConnection=true',
    ),
    MongooseModule.forFeature([
      { name: ProvisioningOrder.name, schema: ProvisioningOrderSchema },
    ]),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: process.env.KAFKA_CLIENT_ID || 'provisioning-service-producer',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
          },
          producer: {
            allowAutoTopicCreation: false,
          },
        },
      },
    ]),
    KafkaToolkitModule,
  ],
  controllers: [ProvisioningServiceController],
  providers: [ProvisioningServiceService],
})
export class ProvisioningServiceModule {}