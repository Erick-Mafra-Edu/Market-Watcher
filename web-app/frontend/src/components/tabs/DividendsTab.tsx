import { useEffect, useMemo, useState } from 'react';
import { getPortfolioDividends } from '../../services/api';
import { PortfolioDividend } from '../../types';

type CurrencyCode = 'BRL' | 'USD';

interface DividendsTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

function formatMoney(value: number, currency: CurrencyCode) {
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function getRelevantDate(item: PortfolioDividend) {
  return item.payment_date || item.ex_date || '';
}

export function DividendsTab({ token, onNotify }: DividendsTabProps) {
  const [walletCurrency, setWalletCurrency] = useState<CurrencyCode>('BRL');
  const [items, setItems] = useState<PortfolioDividend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const dividends = await getPortfolioDividends(token);
        setItems(dividends || []);
      } catch (error: any) {
        onNotify(error.message || 'Falha ao carregar dividendos.', 'error');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, onNotify]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return items
      .filter((item) => {
        const date = getRelevantDate(item);
        if (!date) return false;
        return new Date(date).getTime() >= now.setHours(0, 0, 0, 0);
      })
      .sort((a, b) => new Date(getRelevantDate(a)).getTime() - new Date(getRelevantDate(b)).getTime());
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, { symbol: string; name?: string; totalEstimated: number; nextDate?: string; count: number }>();

    for (const item of upcoming) {
      const symbol = item.symbol;
      const old = map.get(symbol);
      const estimated = Number(item.estimated_payment || 0);
      const date = getRelevantDate(item);

      if (!old) {
        map.set(symbol, {
          symbol,
          name: item.name,
          totalEstimated: estimated,
          nextDate: date,
          count: 1,
        });
      } else {
        old.totalEstimated += estimated;
        old.count += 1;
        if (date && old.nextDate && new Date(date).getTime() < new Date(old.nextDate).getTime()) {
          old.nextDate = date;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (!a.nextDate) return 1;
      if (!b.nextDate) return -1;
      return new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime();
    });
  }, [upcoming]);

  if (loading) {
    return <div className="card">Carregando dividendos...</div>;
  }

  return (
    <section className="stack-lg">
      <div className="card form-grid-4">
        <label className="field stack-xs">
          <span className="tiny muted">Carteira / Moeda de exibicao</span>
          <select value={walletCurrency} onChange={(e) => setWalletCurrency(e.target.value as CurrencyCode)}>
            <option value="BRL">Carteira em Real (BRL)</option>
            <option value="USD">Carteira em Dolar (USD)</option>
          </select>
        </label>
      </div>

      <div className="card stack">
        <h3>Ativos com Dividendos em Breve</h3>
        <p className="muted tiny">Ativos da carteira com proximo evento/pagamento futuro e valor estimado.</p>
        {grouped.length === 0 && <p className="muted">Nao ha dividendos futuros registrados para os ativos da carteira.</p>}
        {grouped.map((item) => (
          <article key={item.symbol} className="list-row">
            <div>
              <strong>{item.symbol}</strong>
              <p className="muted tiny">{item.name || 'Ativo'} | Proxima data: {item.nextDate ? new Date(item.nextDate).toLocaleDateString() : '-'}</p>
            </div>
            <div className="stack-xs" style={{ alignItems: 'flex-end' }}>
              <strong>{formatMoney(item.totalEstimated, walletCurrency)}</strong>
              <span className="tiny muted">{item.count} evento(s)</span>
            </div>
          </article>
        ))}
      </div>

      <div className="card stack">
        <h3>Proximos Pagamentos</h3>
        {upcoming.length === 0 && <p className="muted">Sem pagamentos futuros.</p>}
        {upcoming.map((item, index) => (
          <article key={`${item.symbol}-${item.ex_date || item.payment_date || index}`} className="list-row">
            <div>
              <strong>{item.symbol} · {item.dividend_type || 'Dividendo'}</strong>
              <p className="muted tiny">
                Ex: {item.ex_date ? new Date(item.ex_date).toLocaleDateString() : '-'} | Pagamento: {item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '-'}
              </p>
            </div>
            <div className="stack-xs" style={{ alignItems: 'flex-end' }}>
              <strong>{formatMoney(Number(item.estimated_payment || 0), walletCurrency)}</strong>
              <span className="tiny muted">Por cota: {formatMoney(Number(item.dividend_amount || 0), walletCurrency)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
