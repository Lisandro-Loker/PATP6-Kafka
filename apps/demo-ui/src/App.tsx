import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000';

type SimulateFailureMode = 'none' | 'billing' | 'provisioning';

interface StepStatus {
  status: string;
  at: string | null;
}

interface HistoryItem {
  eventType: string;
  at: string;
}

interface Activation {
  _id: string;
  customerId: string;
  planId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'ACTIVE' | 'FAILED';
  simulateFailure: SimulateFailureMode;
  steps: {
    billing: StepStatus;
    provisioning: StepStatus;
  };
  history: HistoryItem[];
  createdAt: string;
  updatedAt: string;
}

interface LiveEventLog {
  id: string;
  activationId: string;
  eventType: string;
  source: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export default function App() {
  const [customerId, setCustomerId] = useState('C-1234');
  const [planId, setPlanId] = useState('Plan Digital');
  const [simulateFailure, setSimulateFailure] = useState<SimulateFailureMode>('none');
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const [activations, setActivations] = useState<Activation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEventLog[]>([]);

  const fetchActivations = async (selectId?: string) => {
    try {
      const res = await fetch(`${API_URL}/activations`);
      const data: Activation[] = await res.json();
      setActivations(data);
      if (selectId) {
        setSelectedId(selectId);
      } else if (!selectedId && data.length > 0) {
        setSelectedId(data[0]._id);
      }
    } catch (err) {
      console.error('Error cargando activaciones:', err);
    }
  };

  useEffect(() => {
    fetchActivations();

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));

    // RF-08: Escuchar eventos en tiempo real desde ActivationGateway
    socket.on('activation.event', (data: { activationId: string; activationStatus: string; event: any }) => {
      if (data?.event) {
        setLiveEvents((prev) => [
          {
            id: data.event.eventId || `${Date.now()}-${Math.random()}`,
            activationId: data.activationId,
            eventType: data.event.eventType,
            source: data.event.source,
            occurredAt: data.event.occurredAt,
            payload: data.event.payload || {},
          },
          ...prev,
        ]);
      }
      fetchActivations();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/activations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, planId, simulateFailure }),
      });
      const created = await res.json();
      await fetchActivations(created.activationId);
    } catch (err) {
      console.error('Error al crear activación:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedActivation = activations.find((a) => a._id === selectedId) || null;

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'OK':
        return '#10b981';
      case 'FAILED':
        return '#ef4444';
      case 'CANCELLED':
        return '#f59e0b';
      case 'IN_PROGRESS':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  return (
    <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '24px' }}>
      {/* Encabezado */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          marginBottom: '24px',
          borderBottom: '1px solid #334155',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
            POC Activación de Servicios con Kafka
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            Arquitectura orientada a eventos (Saga + Compensación + WebSocket en vivo)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: wsConnected ? '#064e3b' : '#7f1d1d',
              color: wsConnected ? '#34d399' : '#fca5a5',
            }}
          >
            ● WebSocket: {wsConnected ? 'Conectado' : 'Desconectado'}
          </span>
          <a
            href="http://localhost:8080"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#38bdf8', fontSize: '14px', textDecoration: 'none' }}
          >
            Kafka UI ↗
          </a>
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#38bdf8', fontSize: '14px', textDecoration: 'none' }}
          >
            Mailhog ↗
          </a>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
        {/* Columna Izquierda: Formulario + Lista de Activaciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Formulario RF-01 */}
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: '#1e293b',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #334155',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>
              Nueva Solicitud de Activación
            </h2>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                ID del Cliente (Key de partición en Kafka)
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                Plan a contratar
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                }}
              >
                <option value="Plan Digital">Plan Digital</option>
                <option value="Plan Fibra 300MB">Plan Fibra 300MB</option>
                <option value="Plan Corporativo 1GB">Plan Corporativo 1GB</option>
              </select>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                Modo de Simulación (Escenarios Demo)
              </label>
              <select
                value={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.value as SimulateFailureMode)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                }}
              >
                <option value="none">Sin fallos (Escenario 1: Camino Feliz)</option>
                <option value="provisioning">
                  Fallo en Provisioning (Escenario 2: Compensación en Billing)
                </option>
                <option value="billing">Fallo en Billing</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Enviando solicitud...' : 'Activar Servicio'}
            </button>
          </form>

          {/* Historial de Activaciones */}
          <div
            style={{
              backgroundColor: '#1e293b',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #334155',
            }}
          >
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>
              Activaciones Recientes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
              {activations.map((act) => (
                <div
                  key={act._id}
                  onClick={() => setSelectedId(act._id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedId === act._id ? '#334155' : '#0f172a',
                    border: selectedId === act._id ? '1px solid #38bdf8' : '1px solid #1e293b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{act._id}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {act.customerId} · {act.planId}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: getBadgeColor(act.status),
                      color: '#fff',
                    }}
                  >
                    {act.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Detalle y Timeline en Tiempo Real (RF-08) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {selectedActivation ? (
            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid #334155',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '22px' }}>
                    Activación {selectedActivation._id}
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                    Cliente: <strong>{selectedActivation.customerId}</strong> | Plan:{' '}
                    <strong>{selectedActivation.planId}</strong> | Modo fallo:{' '}
                    <code>{selectedActivation.simulateFailure}</code>
                  </p>
                </div>
                <span
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 700,
                    backgroundColor: getBadgeColor(selectedActivation.status),
                  }}
                >
                  {selectedActivation.status}
                </span>
              </div>

              {/* Estado de los pasos en paralelo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
                    Paso 1: Billing Service
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: getBadgeColor(selectedActivation.steps.billing.status),
                    }}
                  >
                    {selectedActivation.steps.billing.status}
                  </span>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
                    Paso 2: Provisioning Service (1-3s delay)
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: getBadgeColor(selectedActivation.steps.provisioning.status),
                    }}
                  >
                    {selectedActivation.steps.provisioning.status}
                  </span>
                </div>
              </div>

              {/* Timeline de la Activación Seleccionada */}
              <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>
                Timeline de Eventos ({selectedActivation.history.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedActivation.history.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${
                        item.eventType.includes('Failed')
                          ? '#ef4444'
                          : item.eventType.includes('Cancelled')
                          ? '#f59e0b'
                          : item.eventType.includes('Completed')
                          ? '#10b981'
                          : '#38bdf8'
                      }`,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.eventType}</div>
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                      {new Date(item.at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px' }}>
              Selecciona o crea una activación para ver su timeline.
            </div>
          )}

          {/* Stream WebSocket en Vivo */}
          <div
            style={{
              backgroundColor: '#1e293b',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #334155',
            }}
          >
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>
              Stream de Eventos WebSocket en Tiempo Real
            </h3>
            {liveEvents.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Esperando eventos en vivo... Crea una nueva solicitud desde el formulario para ver cómo fluyen en tiempo real.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                {liveEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#38bdf8' }}>[{ev.activationId}]</strong>{' '}
                      <strong>{ev.eventType}</strong>{' '}
                      <span style={{ color: '#94a3b8' }}>({ev.source})</span>
                    </div>
                    <span style={{ color: '#64748b' }}>
                      {new Date(ev.occurredAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}