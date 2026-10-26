import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'metrics', versionKey: false })
export class MetricDocument extends Document<string> {
  @Prop({ type: String, default: 'global' })
  declare _id: string;

  @Prop({ type: Number, default: 0 })
  totalRequested: number;

  @Prop({ type: Number, default: 0 })
  totalCompleted: number;

  @Prop({ type: Number, default: 0 })
  totalFailed: number;

  @Prop({ type: Number, default: 0 })
  totalCompensated: number;

  @Prop({ type: Object, default: {} })
  byPlan: Record<string, number>;

  @Prop({ type: Object, default: {} })
  eventsByType: Record<string, number>;

  @Prop({ type: String })
  updatedAt: string;
}

export const MetricSchema = SchemaFactory.createForClass(MetricDocument);