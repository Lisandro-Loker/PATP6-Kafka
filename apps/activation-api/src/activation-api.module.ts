import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaToolkitModule } from '@app/kafka-toolkit';
import { ActivationApiController } from './activation-api.controller';
import { ActivationApiService } from './activation-api.service';
import { Activation, ActivationSchema } from './activation.schema';
import { ActivationGateway } from './activation.gateway';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/activation_api?directConnection=true',
    ),
    MongooseModule.forFeature([{ name: Activation.name, schema: ActivationSchema }]),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: process.env.KAFKA_CLIENT_ID || 'activation-api',
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
  controllers: [ActivationApiController],
  providers: [ActivationApiService, ActivationGateway],
})
export class ActivationApiModule {}