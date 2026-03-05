import { FormEvent, useEffect, useState } from 'react';
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '../../services/api';
import { WatchlistItem } from '../../types';

interface WatchlistTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30 focus:border-[#0f7b6c] transition';

export function WatchlistTab({ token, onNotify }: WatchlistTabProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [symbol, setSymbol] = useState('');
  const [threshold, setThreshold] = useState(5);

  async function load() {
    try {
      setItems(await getWatchlist(token));
    } catch (error: any) {
      onNotify(error.message || 'Falha ao carregar watchlist.', 'error');
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await addToWatchlist(token, symbol.toUpperCase(), threshold);
      onNotify('Ativo adicionado na watchlist.', 'success');
      setSymbol('');
      setThreshold(5);
      await load();
    } catch (error: any) {
      onNotify(error.message || 'Falha ao adicionar ativo.', 'error');
    }
  }

  async function handleDelete(itemSymbol: string) {
    try {
      await removeFromWatchlist(token, itemSymbol);
      onNotify('Ativo removido da watchlist.', 'info');
      await load();
    } catch (error: any) {
      onNotify(error.message || 'Falha ao remover ativo.', 'error');
    }
  }

  return (
    <section className="flex flex-col gap-5">
      {/* Add asset form */}
      <form
        className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <div>
          <h3 className="font-heading font-bold text-slate-800">Adicionar Ativo</h3>
          <p className="text-xs text-slate-400 mt-0.5">Defina simbolo e variacao minima para monitoramento continuo.</p>
        </div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(165px,1fr))]">
          <input
            className={inputCls}
            placeholder="Simbolo (ex: PETR4)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
          />
          <input
            className={inputCls}
            type="number"
            min={0.1}
            step={0.1}
            placeholder="Variacao minima (%)"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            required
          />
          <button
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] shadow-md shadow-teal-200/40 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            type="submit"
          >
            Salvar na watchlist
          </button>
        </div>
      </form>

      {/* Watchlist items */}
      <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-3">
        <h3 className="font-heading font-bold text-slate-800">Minha Watchlist</h3>
        {items.length === 0 && <p className="text-sm text-slate-400">Nenhum ativo cadastrado.</p>}
        {items.map((item) => (
          <article
            key={item.symbol}
            className="border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white/70 hover:bg-white transition"
          >
            <div>
              <strong className="text-sm text-slate-800">{item.symbol}</strong>
              <p className="text-xs text-slate-400 mt-0.5">Threshold: {item.min_price_change ?? 0}%</p>
            </div>
            <button
              onClick={() => handleDelete(item.symbol)}
              className="px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-gradient-to-br from-red-500 to-red-700 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            >
              Remover
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
