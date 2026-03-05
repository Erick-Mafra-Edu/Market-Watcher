import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  addTransaction,
  deletePortfolioTransaction,
  getPortfolioDividends,
  getPortfolio,
  getStockQuote,
  getStockNews,
  getPortfolioTransactions,
  getStockHistory,
  removePortfolioPosition,
} from '../../services/api';
import { NewsItem, PortfolioDividend, PortfolioPosition, PortfolioSummary, PortfolioTransaction } from '../../types';

type CurrencyCode = 'BRL' | 'USD';

interface PortfolioTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

function normalizeHistory(points: any[]) {
  return points
    .map((point: any) => ({
      date: point.date || point.datetime || point.timestamp,
      close: Number(point.close ?? point.price ?? 0),
    }))
    .filter((point: { date: string; close: number }) => point.date && Number.isFinite(point.close) && point.close > 0)
    .sort(
      (a: { date: string; close: number }, b: { date: string; close: number }) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
}

function buildHistoryCandidates(symbol: string) {
  const candidates = [symbol];

  // Common fallback for B3 symbols when provider expects Yahoo suffix.
  if (/^[A-Z]{4}\d{1,2}$/.test(symbol) && !symbol.endsWith('.SA')) {
    candidates.push(`${symbol}.SA`);
  }

  return candidates;
}

function detectSymbolCurrency(symbol: string): CurrencyCode {
  if (symbol.includes('.SA') || /^[A-Z]{4}\d{1,2}$/.test(symbol)) {
    return 'BRL';
  }

  return 'USD';
}

function normalizeCurrency(input?: string): CurrencyCode | null {
  if (!input) return null;
  const value = input.toUpperCase();
  if (value === 'BRL' || value === 'USD') return value;
  return null;
}

function convertCurrency(value: number, from: CurrencyCode, to: CurrencyCode, usdBrlRate: number) {
  if (from === to || !Number.isFinite(value)) {
    return value;
  }

  if (from === 'USD' && to === 'BRL') {
    return value * usdBrlRate;
  }

  if (from === 'BRL' && to === 'USD') {
    return value / usdBrlRate;
  }

  return value;
}

function formatMoney(value: number, currency: CurrencyCode) {
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export function PortfolioTab({ token, onNotify }: PortfolioTabProps) {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [walletCurrency, setWalletCurrency] = useState<CurrencyCode>('BRL');
  const [usdBrlRate, setUsdBrlRate] = useState(5.6);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [detailNews, setDetailNews] = useState<NewsItem[]>([]);
  const [detailDividends, setDetailDividends] = useState<PortfolioDividend[]>([]);
  const [symbolCurrencyMap, setSymbolCurrencyMap] = useState<Record<string, CurrencyCode>>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [rentabilityLabels, setRentabilityLabels] = useState<string[]>([]);
  const [rentabilitySeries, setRentabilitySeries] = useState<number[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [form, setForm] = useState({ symbol: '', quantity: 1, price: 1, type: 'BUY' as 'BUY' | 'SELL', date: '' });
  const performanceCanvas = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);

  async function load() {
    try {
      const data = await getPortfolio(token);
      setPositions(data.positions || []);
      setSummary(data.summary);

      const symbols = (data.positions || []).map((item) => item.symbol);
      if (symbols.length > 0) {
        const updates = await Promise.all(
          symbols.map(async (symbol) => {
            try {
              const quote = await getStockQuote(token, symbol);
              const providerCurrency = normalizeCurrency(quote.currency);
              return [symbol, providerCurrency || detectSymbolCurrency(symbol)] as const;
            } catch {
              return [symbol, detectSymbolCurrency(symbol)] as const;
            }
          })
        );

        setSymbolCurrencyMap((previous) => ({
          ...previous,
          ...Object.fromEntries(updates),
        }));
      }

      if (selectedSymbol && !data.positions.find((item) => item.symbol === selectedSymbol)) {
        setSelectedSymbol(null);
        setTransactions([]);
        setDetailNews([]);
        setDetailDividends([]);
        setRentabilityLabels([]);
        setRentabilitySeries([]);
      }
    } catch (error: any) {
      onNotify(error.message || 'Falha ao carregar portfolio.', 'error');
    }
  }

  async function loadDetails(symbol: string) {
    try {
      setLoadingDetails(true);

      try {
        const quote = await getStockQuote(token, symbol);
        const providerCurrency = normalizeCurrency(quote.currency);
        if (providerCurrency) {
          setSymbolCurrencyMap((previous) => ({ ...previous, [symbol]: providerCurrency }));
        }
      } catch {
        // Keep fallback heuristic when quote lookup fails.
      }

      const now = new Date();
      const from = new Date();
      from.setDate(now.getDate() - 180);

      const [txs, news, dividends] = await Promise.all([
        getPortfolioTransactions(token, symbol),
        getStockNews(token, symbol, 8).catch(() => []),
        getPortfolioDividends(token).catch(() => []),
      ]);

      let normalized: { date: string; close: number }[] = [];
      for (const candidate of buildHistoryCandidates(symbol)) {
        const history = await getStockHistory(token, candidate, from.toISOString().slice(0, 10), now.toISOString().slice(0, 10));
        normalized = normalizeHistory(history);
        if (normalized.length > 1) {
          break;
        }
      }

      if (normalized.length <= 1 && txs.length > 1) {
        // Fallback when provider has little/no candles: infer trend from transaction prices over time.
        normalized = txs
          .map((tx) => ({ date: tx.transaction_date, close: Number(tx.purchase_price) }))
          .filter((point) => point.date && Number.isFinite(point.close) && point.close > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      if (normalized.length > 1) {
        const firstClose = normalized[0].close;
        setRentabilityLabels(normalized.map((point) => new Date(point.date).toLocaleDateString()));
        setRentabilitySeries(normalized.map((point) => ((point.close - firstClose) / firstClose) * 100));
      } else {
        setRentabilityLabels([]);
        setRentabilitySeries([]);
      }

      setTransactions(txs);
      setDetailNews(news);
      setDetailDividends(
        dividends
          .filter((item: PortfolioDividend) => item.symbol === symbol)
          .sort((a: PortfolioDividend, b: PortfolioDividend) => {
            const dateA = new Date(a.payment_date || a.ex_date || '9999-12-31').getTime();
            const dateB = new Date(b.payment_date || b.ex_date || '9999-12-31').getTime();
            return dateA - dateB;
          })
      );
    } catch (error: any) {
      onNotify(error.message || 'Falha ao carregar detalhes do ativo.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    setForm((old) => ({ ...old, date: new Date().toISOString().slice(0, 10) }));
    load();
  }, [token]);

  useEffect(() => {
    const ChartLib = (window as any).Chart;

    if (!selectedSymbol || !performanceCanvas.current || !ChartLib) {
      return;
    }

    chartRef.current?.destroy();
    chartRef.current = new ChartLib(performanceCanvas.current.getContext('2d'), {
      type: 'line',
      data: {
        labels: rentabilityLabels,
        datasets: [
          {
            label: `${selectedSymbol} rentabilidade (%)`,
            data: rentabilitySeries,
            borderColor: '#36c8ff',
            backgroundColor: 'rgba(54, 200, 255, 0.22)',
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { labels: { color: '#edf3ff' } },
          tooltip: {
            callbacks: {
              label: (context: any) => `${Number(context.parsed?.y ?? context.raw ?? 0).toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#b4c2d9' } },
          y: { ticks: { color: '#b4c2d9' } },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [selectedSymbol, rentabilityLabels, rentabilitySeries]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await addTransaction(token, form);
      onNotify('Transacao adicionada com sucesso.', 'success');
      await load();

      if (selectedSymbol && selectedSymbol === form.symbol.toUpperCase()) {
        await loadDetails(selectedSymbol);
      }
    } catch (error: any) {
      onNotify(error.message || 'Falha ao registrar transacao.', 'error');
    }
  }

  async function handleRemovePosition(symbol: string) {
    if (!window.confirm(`Deseja remover toda a posicao de ${symbol}?`)) {
      return;
    }

    try {
      await removePortfolioPosition(token, symbol);
      onNotify(`Posicao ${symbol} removida com sucesso.`, 'info');
      await load();
      if (selectedSymbol === symbol) {
        setSelectedSymbol(null);
      }
    } catch (error: any) {
      onNotify(error.message || 'Falha ao remover posicao.', 'error');
    }
  }

  async function handleDeleteTransaction(transactionId: number) {
    try {
      await deletePortfolioTransaction(token, transactionId);
      onNotify('Transacao removida.', 'info');

      if (selectedSymbol) {
        await Promise.all([load(), loadDetails(selectedSymbol)]);
      } else {
        await load();
      }
    } catch (error: any) {
      onNotify(error.message || 'Falha ao remover transacao.', 'error');
    }
  }

  async function handleDetails(symbol: string) {
    if (selectedSymbol === symbol) {
      setSelectedSymbol(null);
      return;
    }

    setSelectedSymbol(symbol);
    await loadDetails(symbol);
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
        <label className="field stack-xs">
          <span className="tiny muted">Taxa USD-BRL (1 USD = ? BRL)</span>
          <input
            type="number"
            min={0.0001}
            step={0.0001}
            value={usdBrlRate}
            onChange={(e) => setUsdBrlRate(Math.max(0.0001, Number(e.target.value) || 0.0001))}
          />
        </label>
      </div>

      {summary && (
        <div className="stats-grid">
          <article className="stat-card"><span>Total Atual</span><strong>{formatMoney(summary.totalCurrent, walletCurrency)}</strong></article>
          <article className="stat-card"><span>Total Investido</span><strong>{formatMoney(summary.totalInvested, walletCurrency)}</strong></article>
          <article className="stat-card"><span>P/L</span><strong>{formatMoney(summary.totalProfitLoss, walletCurrency)}</strong></article>
          <article className="stat-card"><span>Posicoes</span><strong>{summary.positionsCount}</strong></article>
        </div>
      )}

      <form className="card form-grid-4" onSubmit={handleSubmit}>
        <h3>Nova Transacao</h3>
        <p className="muted tiny">Registre compras e vendas para manter o desempenho atualizado.</p>
        <label className="field stack-xs">
          <span className="tiny muted">Simbolo do ativo</span>
          <input
            placeholder="Ex: BBDC3"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
            required
          />
        </label>
        <label className="field stack-xs">
          <span className="tiny muted">Quantidade</span>
          <input
            type="number"
            min={0.0001}
            step={0.0001}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            required
          />
        </label>
        <label className="field stack-xs">
          <span className="tiny muted">Preco unitario</span>
          <input
            type="number"
            min={0.0001}
            step={0.0001}
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            required
          />
        </label>
        <label className="field stack-xs">
          <span className="tiny muted">Tipo de transacao</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'BUY' | 'SELL' })}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>
        <label className="field stack-xs">
          <span className="tiny muted">Data da transacao</span>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </label>
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
              <p className="muted tiny">
                Qtd: {position.quantity} | Medio: {formatMoney(
                  convertCurrency(
                    position.avgPurchasePrice,
                    symbolCurrencyMap[position.symbol] || detectSymbolCurrency(position.symbol),
                    walletCurrency,
                    usdBrlRate
                  ),
                  walletCurrency
                )} | Atual: {formatMoney(
                  convertCurrency(
                    position.currentPrice,
                    symbolCurrencyMap[position.symbol] || detectSymbolCurrency(position.symbol),
                    walletCurrency,
                    usdBrlRate
                  ),
                  walletCurrency
                )}
              </p>
            </div>
            <div className="row-actions">
              <strong className={position.profitLoss >= 0 ? 'profit' : 'loss'}>{formatMoney(
                convertCurrency(
                  position.profitLoss,
                  symbolCurrencyMap[position.symbol] || detectSymbolCurrency(position.symbol),
                  walletCurrency,
                  usdBrlRate
                ),
                walletCurrency
              )}</strong>
              <button className="btn" type="button" onClick={() => handleDetails(position.symbol)}>
                {selectedSymbol === position.symbol ? 'Fechar detalhes' : 'Ver detalhes'}
              </button>
              <button className="btn danger" type="button" onClick={() => handleRemovePosition(position.symbol)}>
                Remover posicao
              </button>
            </div>
          </article>
        ))}

        {selectedSymbol && (
          <section className="details-panel stack">
            <h3>Detalhes de {selectedSymbol}</h3>
            <p className="muted tiny">Moeda da carteira: {walletCurrency}</p>
            {loadingDetails && <p className="muted">Carregando detalhes...</p>}

            {!loadingDetails && (
              <>
                <p className="muted tiny">Historico de transacoes e grafico de rentabilidade dos ultimos 6 meses.</p>

                <div className="card chart-box">
                  {rentabilitySeries.length > 1 ? (
                    <canvas ref={performanceCanvas} />
                  ) : (
                    <p className="muted">Sem historico suficiente para montar grafico de rentabilidade.</p>
                  )}
                </div>

                <div className="stack">
                  <h3>Transacoes</h3>
                  {transactions.length === 0 && <p className="muted">Sem transacoes para este ativo.</p>}
                  {transactions.map((tx) => (
                    <article key={tx.id} className="list-row">
                      <div className="stack-xs">
                        <strong>
                          {tx.transaction_type} · {tx.quantity} @ {formatMoney(
                            convertCurrency(
                              Number(tx.purchase_price),
                              symbolCurrencyMap[selectedSymbol || tx.symbol] || detectSymbolCurrency(selectedSymbol || tx.symbol),
                              walletCurrency,
                              usdBrlRate
                            ),
                            walletCurrency
                          )}
                        </strong>
                        <p className="muted tiny">Data: {new Date(tx.transaction_date).toLocaleDateString()}</p>
                      </div>
                      <button className="btn danger" type="button" onClick={() => handleDeleteTransaction(tx.id)}>
                        Remover transacao
                      </button>
                    </article>
                  ))}
                </div>

                <div className="stack">
                  <h3>Proximos Dividendos</h3>
                  {detailDividends.length === 0 && <p className="muted">Sem dividendos registrados para este ativo.</p>}
                  {detailDividends.map((item, index) => (
                    <article key={`${item.symbol}-${item.ex_date || item.payment_date || index}`} className="list-row">
                      <div className="stack-xs">
                        <strong>{item.dividend_type || 'Dividendo'}</strong>
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

                <div className="stack">
                  <h3>Noticias Relacionadas</h3>
                  {detailNews.length === 0 && <p className="muted">Sem noticias relacionadas no momento.</p>}
                  {detailNews.map((item) => (
                    <article key={item.id} className="list-row">
                      <div>
                        <strong>{item.title}</strong>
                        <p className="muted tiny">{new Date(item.published_at).toLocaleString()}</p>
                      </div>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
