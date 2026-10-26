import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KafkaToolkitModule } from '@app/kafka-toolkit';
import { CrmAnalyticsServiceController } from './crm-analytics-service.controller';
import { CrmAnalyticsServiceService } from './crm-analytics-service.service';
import { MetricDocument, MetricSchema } from './metric.schema';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI ||
        'mongodb://127.0.0.1:27017/crm_analytics?directConnection=true',
    ),
    MongooseModule.forFeature([
      { name: MetricDocument.name, schema: MetricSchema },
    ]),
    KafkaToolkitModule,
  ],
  controllers: [CrmAnalyticsServiceController],
  providers: [CrmAnalyticsServiceService],
})
export class CrmAnalyticsServiceModule {}