import { FormEvent, useEffect, useState } from 'react';
import { addTransaction, getPortfolio } from '../../services/api';
import { PortfolioPosition, PortfolioSummary } from '../../types';

interface PortfolioTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function PortfolioTab({ token, onNotify }: PortfolioTabProps) {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [form, setForm] = useState({ symbol: '', quantity: 1, price: 1, type: 'BUY' as 'BUY' | 'SELL', date: '' });

  async function load() {
    try {
      const data = await getPortfolio(token);
      setPositions(data.positions || []);
      setSummary(data.summary);
    } catch (error: any) {
      onNotify(error.message || 'Falha ao carregar portfolio.', 'error');
    }
  }

  useEffect(() => {
    setForm((old) => ({ ...old, date: new Date().toISOString().slice(0, 10) }));
    load();
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await addTransaction(token, form);
      onNotify('Transacao adicionada com sucesso.', 'success');
      await load();
    } catch (error: any) {
      onNotify(error.message || 'Falha ao registrar transacao.', 'error');
    }
  }

  return (
    <section className="stack-lg">
      {summary && (
        <div className="stats-grid">
          <article className="stat-card"><span>Total Atual</span><strong>${summary.totalCurrent.toFixed(2)}</strong></article>
          <article className="stat-card"><span>Total Investido</span><strong>${summary.totalInvested.toFixed(2)}</strong></article>
          <article className="stat-card"><span>P/L</span><strong>${summary.totalProfitLoss.toFixed(2)}</strong></article>
          <article className="stat-card"><span>Posicoes</span><strong>{summary.positionsCount}</strong></article>
        </div>
      )}

      <form className="card form-grid-4" onSubmit={handleSubmit}>
        <h3>Nova Transacao</h3>
        <p className="muted tiny">Registre compras e vendas para manter o desempenho atualizado.</p>
        <input placeholder="Simbolo" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} required />
        <input type="number" min={0.0001} step={0.0001} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required />
        <input type="number" min={0.0001} step={0.0001} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'BUY' | 'SELL' })}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <button className="btn btn-primary" type="submit">Salvar</button>
      </form>

      <div className="card stack">
        <h3>Posicoes</h3>
        <p className="muted tiny">Visao consolidada por ativo com preco medio e lucro/prejuizo atual.</p>
        {positions.length === 0 && <p className="muted">Nenhuma posicao aberta.</p>}
        {positions.map((position) => (
          <article key={position.symbol} className="list-row">
            <div>
              <strong>{position.symbol}</strong>
              <p className="muted tiny">Qtd: {position.quantity} | Medio: ${position.avgPurchasePrice.toFixed(2)} | Atual: ${position.currentPrice.toFixed(2)}</p>
            </div>
            <strong className={position.profitLoss >= 0 ? 'profit' : 'loss'}>${position.profitLoss.toFixed(2)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
