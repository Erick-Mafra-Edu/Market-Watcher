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

  const unreadCount = items.filter((i) => !i.read_at).length;

  return (
    <section className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-slate-800">Alertas</h3>
          <p className="text-xs text-slate-400 mt-0.5">Mensagens geradas por variacoes e eventos monitorados.</p>
        </div>
        {unreadCount > 0 && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
            {unreadCount} nao {unreadCount === 1 ? 'lido' : 'lidos'}
          </span>
        )}
      </div>

      {items.length === 0 && <p className="text-sm text-slate-400">Sem alertas no momento.</p>}

      {items.map((item) => (
        <article
          key={item.id}
          className={`border rounded-xl px-4 py-3 flex items-start justify-between gap-3 bg-white/70 hover:bg-white transition ${
            item.read_at ? 'border-slate-100' : 'border-l-4 border-l-orange-400 border-slate-100'
          }`}
        >
          <div className="flex flex-col gap-1">
            <strong className="text-sm text-slate-800">{item.title}</strong>
            <p className="text-xs text-slate-600">{item.message}</p>
            <small className="text-xs text-slate-400">{new Date(item.sent_at).toLocaleString()}</small>
          </div>
          {!item.read_at && (
            <button
              onClick={() => handleRead(item.id)}
              className="px-3 py-1.5 rounded-xl font-semibold text-xs cursor-pointer border border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:-translate-y-0.5 transition-all duration-150 whitespace-nowrap"
            >
              Marcar como lido
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
