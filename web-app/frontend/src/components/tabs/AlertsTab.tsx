import { useEffect, useState } from 'react';
import { getAlerts, markAlertRead } from '../../services/api';
import { AlertItem } from '../../types';

interface AlertsTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function AlertsTab({ token, onNotify }: AlertsTabProps) {
  const [items, setItems] = useState<AlertItem[]>([]);

  async function load() {
    try {
      setItems(await getAlerts(token));
    } catch (error: any) {
      onNotify(error.message || 'Falha ao carregar alertas.', 'error');
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleRead(id: number) {
    try {
      await markAlertRead(token, id);
      await load();
    } catch (error: any) {
      onNotify(error.message || 'Falha ao marcar alerta como lido.', 'error');
    }
  }

  return (
    <section className="card stack">
      <h3>Alertas</h3>
      <p className="muted tiny">Mensagens geradas por variacoes e eventos monitorados.</p>
      {items.length === 0 && <p className="muted">Sem alertas no momento.</p>}
      {items.map((item) => (
        <article key={item.id} className={`list-row ${item.read_at ? '' : 'unread'}`}>
          <div className="stack-xs">
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <small className="muted">{new Date(item.sent_at).toLocaleString()}</small>
          </div>
          {!item.read_at && (
            <button className="btn" onClick={() => handleRead(item.id)}>
              Marcar como lido
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
