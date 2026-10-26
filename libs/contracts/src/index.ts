// 1. Nombres de los Topics (convención dominio.tipo)
export const TOPICS = {
  ACTIVATION_REQUESTED: 'activation.requested',
  BILLING_EVENTS: 'billing.events',
  PROVISIONING_EVENTS: 'provisioning.events',
  ACTIVATION_EVENTS: 'activation.events',
} as const;

// Helper para obtener el topic DLQ (<topic>.dlq)
export const getDlqTopic = (topic: string) => `${topic}.dlq`;

// 2. Tipos de Eventos (nombres en pasado, describen un hecho)
export enum EventType {
  ACTIVATION_REQUESTED = 'ActivationRequested',
  BILLING_ACCOUNT_CREATED = 'BillingAccountCreated',
  BILLING_FAILED = 'BillingFailed',
  BILLING_ACCOUNT_CANCELLED = 'BillingAccountCancelled',
  PROVISIONING_COMPLETED = 'ProvisioningCompleted',
  PROVISIONING_FAILED = 'ProvisioningFailed',
  ACTIVATION_COMPLETED = 'ActivationCompleted',
  ACTIVATION_FAILED = 'ActivationFailed',
}

// 3. Modos de fallo simulado para la Demo
export type SimulateFailureMode = 'none' | 'billing' | 'provisioning';

// 4. Estados de la Activación (Máquina de estados en activation-api)
export enum ActivationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
}

// 5. Sobre Común de Eventos (Definido como class para que Rspack lo reconozca en decoradores @Payload)
export class EventEnvelope<T = any> {
  eventId: string;
  eventType: EventType;
  version: number;
  occurredAt: string;
  correlationId: string;
  customerId: string;
  source: string;
  payload: T;
}

// 6. Payloads específicos según el tipo de evento
export interface ActivationRequestedPayload {
  planId: string;
  channel: string;
  simulateFailure: SimulateFailureMode;
}

export interface BillingResultPayload {
  accountId?: string;
  reason?: string;
}

export interface ProvisioningResultPayload {
  orderId?: string;
  reason?: string;
}

export interface ActivationFinalPayload {
  planId: string;
  status: ActivationStatus.ACTIVE | ActivationStatus.FAILED;
  reason?: string;
}