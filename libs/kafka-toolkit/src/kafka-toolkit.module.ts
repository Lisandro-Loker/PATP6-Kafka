import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaToolkitService } from './kafka-toolkit.service';
import { ProcessedEvent, ProcessedEventSchema } from './processed-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProcessedEvent.name, schema: ProcessedEventSchema },
    ]),
    ClientsModule.register([
      {
        name: 'TOOLKIT_KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          producerOnlyMode: true,
          client: {
            clientId: `toolkit-dlq-${Math.random().toString(36).substring(2, 8)}`,
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
          },
          producer: {
            allowAutoTopicCreation: false,
          },
        },
      },
    ]),
  ],
  providers: [KafkaToolkitService],
  exports: [KafkaToolkitService],
})
export class KafkaToolkitModule {}