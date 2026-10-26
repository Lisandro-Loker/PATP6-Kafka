# TP6 — POC Activación de Servicios con Apache Kafka

Prueba de concepto de una arquitectura orientada a eventos (Saga Coreografiada / Agregador con Compensación) para la activación de planes de telecomunicaciones, implementada con **NestJS (Monorepo)**, **Apache Kafka (KRaft)**, **MongoDB**, **React (Vite + WebSockets)** y **Mailhog**.

---

## 1. Arquitectura y Microservicios

El sistema está compuesto por 5 microservicios independientes (cada uno con su propia base de datos en MongoDB), 1 aplicación frontend y 2 librerías compartidas:

| Componente | Tipo | Puerto HTTP | Consumer Group | Base de Datos MongoDB | Responsabilidad |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`activation-api`** | Híbrido (REST + WS + Kafka) | `3000` | `activation-api-group` | `activation_api` | Recibe solicitudes (`POST /activations`), coordina el estado de la activación y emite actualizaciones por WebSocket. |
| **`billing-service`** | Microservicio Kafka | N/A | `billing-svc` | `billing_service` | Crea cuentas de facturación (`CREATED`) y ejecuta la compensación (`CANCELLED`) ante `ActivationFailed`. |
| **`provisioning-service`** | Microservicio Kafka | N/A | `provisioning-svc` | `provisioning_service` | Simula el aprovisionamiento técnico con retardo de 1 a 3 segundos. |
| **`notification-service`** | Microservicio Kafka | N/A | `notification-svc` | `notification_service` | Envía emails de bienvenida o de error a través de Mailhog (SMTP `1025`). |
| **`crm-analytics-service`** | Híbrido (REST + Kafka) | `3005` | `crm-analytics-svc` | `crm_analytics` | Escucha todos los topics de forma desacoplada y expone métricas en `GET /metrics`. |
| **`demo-ui`** | Frontend (React + Vite) | `5173` | N/A | N/A | Formulario de contratación y visualización de la timeline en tiempo real vía WebSocket. |

### Librerías compartidas (`libs/`)
* **`@app/contracts`**: Definición de topics, tipos de eventos (`EventType`), estados (`ActivationStatus`) y sobre común (`EventEnvelope`).
* **`@app/kafka-toolkit`**: Idempotencia mediante colección `processed_events` (índice único `eventId + consumerGroup`), reintentos con backoff exponencial (3 intentos: `500ms`, `1000ms`, `2000ms`) y desvío automático a `<topic>.dlq` con headers de diagnóstico (`x-original-topic`, `x-error-message`, `x-retry-count`, `x-failed-at`).

---

## 2. Puertos de Infraestructura (Docker)

* **Kafka Broker (KRaft):** `localhost:9092`
* **Kafka UI:** [http://localhost:8080](http://localhost:8080)
* **MongoDB (Replica Set `rs0`):** `localhost:27017`
* **Mailhog (Bandeja Web):** [http://localhost:8025](http://localhost:8025) (SMTP en `localhost:1025`)

---

## 3. Instrucciones de Puesta en Marcha

### Paso 1: Levantar infraestructura y crear topics
```bash
docker compose up -d
docker exec -it kafka /bin/sh / create-topics.sh
```
### Paso 2: Instalar dependencias
En la raíz del monorepo:

```Bash
npm install
```

Paso 3: Iniciar los microservicios y la UI
Ejecutar cada servicio en una terminal desde la raíz del proyecto:

```Bash
# Terminal 1: API Principal + WebSocket Gateway
npm run start:dev activation-api

# Terminal 2: Servicio de Facturación
npm run start:dev billing-service

# Terminal 3: Servicio de Aprovisionamiento
npm run start:dev provisioning-service

# Terminal 4: Servicio de Notificaciones
npm run start:dev notification-service

# Terminal 5: Servicio de Métricas CRM
npm run start:dev crm-analytics-service

# Terminal 6: Interfaz Web (ejecutar dentro de apps/demo-ui)
cd apps/demo-ui && npm run dev
```

### Paso 4: Guía para Ejecutar los 5 Escenarios de Demostración
# Escenario 1 — Camino Feliz (simulateFailure: "none"):
En http://localhost:5173, seleccionar "Sin fallos" y enviar.

La activación pasa de PENDING -> IN_PROGRESS -> ACTIVE y se recibe el email de bienvenida en Mailhog (http://localhost:8025).

# Escenario 2 — Fallo en Provisioning y Compensación (simulateFailure: "provisioning"):
En la UI, seleccionar "Fallo en Provisioning" y enviar.

billing-service crea la cuenta (OK), luego provisioning-service falla (FAILED), activation-api emite ActivationFailed y billing-service compensa anulando la cuenta (CANCELLED).

# Escenario 3 — Desacoplamiento y Métricas (crm-analytics-service):
Consultar http://localhost:3005/metrics para observar las métricas consolidadas en tiempo real sin acoplamiento directo con los demás servicios.

# Escenario 4 — Idempotencia (processed_events):
Desde Kafka UI (http://localhost:8080), copiar el JSON de un mensaje existente en activation.requested y volver a publicarlo con el mismo eventId.

Los consumidores registran [Idempotencia] Evento duplicado ignorado sin duplicar cuentas, órdenes ni métricas.

# Escenario 5 — Mensaje Corrupto y Dead Letter Queue (.dlq):
Desde Kafka UI, publicar en activation.requested un JSON inválido (por ejemplo, {"corrupto": true}).

Los consumidores realizan 3 intentos con backoff exponencial (500ms, 1000ms, 2000ms) y publican el mensaje fallido en activation.requested.dlq con los headers x-original-topic, x-error-message, x-retry-count y x-failed-at.