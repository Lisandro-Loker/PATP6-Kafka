import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'processed_events', versionKey: false })
export class ProcessedEvent extends Document {
  @Prop({ type: String, required: true })
  eventId: string;

  @Prop({ type: String, required: true })
  consumerGroup: string;

  @Prop({ type: String, required: true })
  eventType: string;

  @Prop({ type: String, required: true })
  processedAt: string;
}

export const ProcessedEventSchema = SchemaFactory.createForClass(ProcessedEvent);

// Índice compuesto único (eventId + consumerGroup) para garantizar idempotencia
ProcessedEventSchema.index({ eventId: 1, consumerGroup: 1 }, { unique: true });