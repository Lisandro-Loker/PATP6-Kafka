import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaToolkitModule } from '@app/kafka-toolkit';
import { BillingServiceController } from './billing-service.controller';
import { BillingServiceService } from './billing-service.service';
import { BillingAccount, BillingAccountSchema } from './billing-account.schema';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/billing_service?directConnection=true',
    ),
    MongooseModule.forFeature([
      { name: BillingAccount.name, schema: BillingAccountSchema },
    ]),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: process.env.KAFKA_CLIENT_ID || 'billing-service-producer',
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
  controllers: [BillingServiceController],
  providers: [BillingServiceService],
})
export class BillingServiceModule {}