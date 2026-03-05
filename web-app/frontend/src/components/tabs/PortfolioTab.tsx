import { FormEvent, useEffect, useState } from 'react';
import { addTransaction, getPortfolio } from '../../services/api';
import { PortfolioPosition, PortfolioSummary } from '../../types';

interface PortfolioTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30 focus:border-[#0f7b6c] transition';

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
    <section className="flex flex-col gap-5">
      {/* Summary stats */}
      {summary && (
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(185px,1fr))]">
          <article className="stat-card">
            <span className="text-sm text-teal-100">Total Atual</span>
            <strong>${summary.totalCurrent.toFixed(2)}</strong>
          </article>
          <article className="stat-card">
            <span className="text-sm text-teal-100">Total Investido</span>
            <strong>${summary.totalInvested.toFixed(2)}</strong>
          </article>
          <article className="stat-card">
            <span className="text-sm text-teal-100">P/L</span>
            <strong className={summary.totalProfitLoss >= 0 ? 'text-emerald-200' : 'text-red-300'}>
              ${summary.totalProfitLoss.toFixed(2)}
            </strong>
          </article>
          <article className="stat-card">
            <span className="text-sm text-teal-100">Posicoes</span>
            <strong>{summary.positionsCount}</strong>
          </article>
        </div>
      )}

      {/* New transaction form */}
      <form
        className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <div>
          <h3 className="font-heading font-bold text-slate-800">Nova Transacao</h3>
          <p className="text-xs text-slate-400 mt-0.5">Registre compras e vendas para manter o desempenho atualizado.</p>
        </div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(165px,1fr))]">
          <input
            className={inputCls}
            placeholder="Simbolo (ex: AAPL)"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
            required
          />
          <input
            className={inputCls}
            type="number"
            min={0.0001}
            step={0.0001}
            placeholder="Quantidade"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            required
          />
          <input
            className={inputCls}
            type="number"
            min={0.0001}
            step={0.0001}
            placeholder="Preco"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            required
          />
          <select
            className={inputCls}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'BUY' | 'SELL' })}
          >
            <option value="BUY">Compra (BUY)</option>
            <option value="SELL">Venda (SELL)</option>
          </select>
          <input
            className={inputCls}
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <button
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] shadow-md shadow-teal-200/40 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            type="submit"
          >
            Salvar
          </button>
        </div>
      </form>

      {/* Positions list */}
      <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-3">
        <div>
          <h3 className="font-heading font-bold text-slate-800">Posicoes</h3>
          <p className="text-xs text-slate-400 mt-0.5">Visao consolidada por ativo com preco medio e lucro/prejuizo atual.</p>
        </div>
        {positions.length === 0 && <p className="text-sm text-slate-400">Nenhuma posicao aberta.</p>}
        {positions.map((position) => (
          <article
            key={position.symbol}
            className="border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white/70 hover:bg-white transition"
          >
            <div>
              <strong className="text-sm text-slate-800">{position.symbol}</strong>
              <p className="text-xs text-slate-400 mt-0.5">
                Qtd: {position.quantity} &nbsp;|&nbsp; Medio: ${position.avgPurchasePrice.toFixed(2)} &nbsp;|&nbsp; Atual: ${position.currentPrice.toFixed(2)}
              </p>
            </div>
            <strong className={`text-sm font-bold ${position.profitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {position.profitLoss >= 0 ? '+' : ''}${position.profitLoss.toFixed(2)}
            </strong>
          </article>
        ))}
      </div>
    </section>
  );
}
