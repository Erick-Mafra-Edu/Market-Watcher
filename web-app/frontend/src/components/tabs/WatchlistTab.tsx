import { FormEvent, useEffect, useState } from 'react';
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '../../services/api';
import { WatchlistItem } from '../../types';

interface WatchlistTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

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
    <section className="stack-lg">
      <form className="card form-grid" onSubmit={handleSubmit}>
        <h3>Adicionar Ativo</h3>
        <p className="muted tiny">Defina simbolo e variacao minima para monitoramento continuo.</p>
        <input placeholder="Ex: PETR4" value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          required
        />
        <button className="btn btn-primary" type="submit">
          Salvar na watchlist
        </button>
      </form>

      <div className="card stack">
        <h3>Minha Watchlist</h3>
        {items.length === 0 && <p className="muted">Nenhum ativo cadastrado.</p>}
        {items.map((item) => (
          <article key={item.symbol} className="list-row">
            <div>
              <strong>{item.symbol}</strong>
              <p className="muted tiny">Threshold: {item.min_price_change ?? 0}%</p>
            </div>
            <button className="btn danger" onClick={() => handleDelete(item.symbol)}>
              Remover
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
