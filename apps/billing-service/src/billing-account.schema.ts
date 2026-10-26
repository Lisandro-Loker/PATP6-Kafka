import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BillingAccountStatus = 'CREATED' | 'CANCELLED';

@Schema({ collection: 'billing_accounts', versionKey: false })
export class BillingAccount extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  activationId: string;

  @Prop({ type: String, required: true })
  customerId: string;

  @Prop({ type: String, required: true })
  planId: string;

  @Prop({ type: String, enum: ['CREATED', 'CANCELLED'], required: true })
  status: BillingAccountStatus;

  @Prop({ type: String })
  createdAt: string;

  @Prop({ type: String })
  updatedAt: string;
}

export const BillingAccountSchema = SchemaFactory.createForClass(BillingAccount);