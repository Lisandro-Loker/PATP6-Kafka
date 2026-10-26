#!/bin/bash
set -e

BOOTSTRAP_SERVER="kafka:29092"
RETENTION_MS=604800000

echo "Esperando a que Kafka responda..."
/opt/kafka/bin/kafka-topics.sh --bootstrap-server $BOOTSTRAP_SERVER --list

TOPICS=(
  "activation.requested"
  "billing.events"
  "provisioning.events"
  "activation.events"
  "activation.requested.dlq"
  "billing.events.dlq"
  "provisioning.events.dlq"
  "activation.events.dlq"
)

for TOPIC in "${TOPICS[@]}"; do
  echo "Creando topic: $TOPIC (3 particiones, retencion 7 dias)"
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server $BOOTSTRAP_SERVER \
    --create --if-not-exists \
    --topic "$TOPIC" \
    --partitions 3 \
    --replication-factor 1 \
    --config retention.ms=$RETENTION_MS
done

echo "Topics creados exitosamente:"
/opt/kafka/bin/kafka-topics.sh --bootstrap-server $BOOTSTRAP_SERVER --list