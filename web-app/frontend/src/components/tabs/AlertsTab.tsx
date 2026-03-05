import { useEffect, useState } from 'react';
import { getAlerts, markAlertRead } from '../../services/api';
import { AlertItem } from '../../types';

interface AlertsTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function AlertsTab({ token, onNotify }: AlertsTabProps) {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  function extractSymbols(item: AlertItem): string[] {
    const symbols = new Set<string>();

    if (item.symbol) {
      symbols.add(item.symbol.toUpperCase());
    }

    const haystack = `${item.title} ${item.message}`.toUpperCase();
    const matches = haystack.match(/\b[A-Z]{4}\d{1,2}(?:\.SA)?\b|\b[A-Z]{1,5}\.SA\b/g) || [];

    for (const match of matches) {
      symbols.add(match);
    }

    return Array.from(symbols);
  }

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
  const assetOptions = Array.from(new Set(items.flatMap((item) => extractSymbols(item)))).sort();

  const filteredItems = items.filter((item) => {
    const isUnread = !item.read_at;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unread' && isUnread) ||
      (statusFilter === 'read' && !isUnread);

    const symbols = extractSymbols(item);
    const matchesAsset = assetFilter === 'all' || symbols.includes(assetFilter);

    const haystack = `${item.title} ${item.message}`.toLowerCase();
    const matchesSearch = !searchTerm.trim() || haystack.includes(searchTerm.trim().toLowerCase());

    return matchesStatus && matchesAsset && matchesSearch;
  });

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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,1fr))] gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'unread' | 'read')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30"
          >
            <option value="all">Todos</option>
            <option value="unread">Nao lidos</option>
            <option value="read">Lidos</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Ativo impactado
          <select
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30"
          >
            <option value="all">Todos os ativos</option>
            {assetOptions.map((symbol) => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Buscar no alerta
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Titulo ou mensagem"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30"
          />
        </label>
      </div>

      {items.length === 0 && <p className="text-sm text-slate-400">Sem alertas no momento.</p>}
      {items.length > 0 && filteredItems.length === 0 && (
        <p className="text-sm text-slate-400">Nenhum alerta encontrado com os filtros atuais.</p>
      )}

      {filteredItems.map((item) => (
        <article
          key={item.id}
          className={`border rounded-xl px-4 py-3 flex items-start justify-between gap-3 bg-white/70 hover:bg-white transition ${
            item.read_at ? 'border-slate-100' : 'border-l-4 border-l-orange-400 border-slate-100'
          }`}
        >
          <div className="flex flex-col gap-1">
            <strong className="text-sm text-slate-800">{item.title}</strong>
            <p className="text-xs text-slate-600">{item.message}</p>
            <div className="flex flex-wrap gap-1.5">
              {!item.read_at ? (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700">Nao lido</span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">Lido</span>
              )}
              {extractSymbols(item).map((symbol) => (
                <span key={`${item.id}-${symbol}`} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-700">
                  Ativo: {symbol}
                </span>
              ))}
            </div>
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
