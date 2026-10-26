import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'notifications', versionKey: false })
export class NotificationRecord extends Document {
  @Prop({ type: String, required: true })
  activationId: string;

  @Prop({ type: String, required: true })
  customerId: string;

  @Prop({ type: String, required: true })
  eventType: string;

  @Prop({ type: String, required: true })
  recipient: string;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: String, required: true })
  sentAt: string;
}

export const NotificationRecordSchema = SchemaFactory.createForClass(NotificationRecord);
// Índice definido en Sección 07: activationId + eventType
NotificationRecordSchema.index({ activationId: 1, eventType: 1 }, { unique: true });