import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KafkaToolkitModule } from '@app/kafka-toolkit';
import { NotificationServiceController } from './notification-service.controller';
import { NotificationServiceService } from './notification-service.service';
import { NotificationRecord, NotificationRecordSchema } from './notification.schema';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI ||
        'mongodb://127.0.0.1:27017/notification_service?directConnection=true',
    ),
    MongooseModule.forFeature([
      { name: NotificationRecord.name, schema: NotificationRecordSchema },
    ]),
    KafkaToolkitModule,
  ],
  controllers: [NotificationServiceController],
  providers: [NotificationServiceService],
})
export class NotificationServiceModule {}