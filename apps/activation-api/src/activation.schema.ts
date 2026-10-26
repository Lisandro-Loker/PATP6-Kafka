import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ActivationStatus, type SimulateFailureMode } from '@app/contracts';

@Schema({ collection: 'activations', versionKey: false })
export class Activation extends Document<string> {
  @Prop({ type: String, required: true })
  declare _id: string; // activationId (ej: act-0001)

  @Prop({ type: String, required: true, index: true })
  customerId: string;

  @Prop({ type: String, required: true })
  planId: string;

  @Prop({ type: String, enum: ActivationStatus, default: ActivationStatus.PENDING })
  status: ActivationStatus;

  @Prop({ type: String, default: 'none' })
  simulateFailure: SimulateFailureMode;

  @Prop({
    type: Object,
    default: () => ({
      billing: { status: 'PENDING', at: null },
      provisioning: { status: 'PENDING', at: null },
    }),
  })
  steps: {
    billing: { status: string; at: string | null };
    provisioning: { status: string; at: string | null };
  };

  @Prop({ type: Array, default: [] })
  history: Array<{ eventType: string; at: string }>;

  @Prop({ type: String })
  createdAt: string;

  @Prop({ type: String })
  updatedAt: string;
}

export const ActivationSchema = SchemaFactory.createForClass(Activation);