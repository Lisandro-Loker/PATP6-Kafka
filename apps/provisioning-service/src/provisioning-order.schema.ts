import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'provisioning_orders', versionKey: false })
export class ProvisioningOrder extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  activationId: string;

  @Prop({ type: String, required: true })
  customerId: string;

  @Prop({ type: String, required: true })
  planId: string;

  @Prop({ type: String, required: true })
  status: 'COMPLETED' | 'FAILED';

  @Prop({ type: String })
  createdAt: string;
}

export const ProvisioningOrderSchema = SchemaFactory.createForClass(ProvisioningOrder);