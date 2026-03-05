import { useEffect, useRef, useState } from 'react';
import {
  getAlerts,
  getNews,
  getPortfolio,
  getPortfolioPerformance,
  getPortfolioTransactions,
  getStockQuote,
  getStockHistory,
  getWatchlist,
} from '../../services/api';
import { NewsItem, PortfolioPosition, PortfolioTransaction } from '../../types';

type CurrencyCode = 'BRL' | 'USD';

interface DashboardTabProps {
  token: string;
  onError: (message: string) => void;
}

interface DashboardState {
  totalCurrent: number;
  totalProfitLoss: number;
  watchlistCount: number;
  unreadAlerts: number;
  news: NewsItem[];
  positions: PortfolioPosition[];
  performance: { labels: string[]; values: number[] };
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

function getSentimentLabel(sentiment?: NewsItem['sentiment']) {
  if (sentiment === 'positive') return 'Positiva';
  if (sentiment === 'negative') return 'Negativa';
  return 'Neutra';
}

function getSentimentClass(sentiment?: NewsItem['sentiment']) {
  if (sentiment === 'positive') return 'sentiment-positive';
  if (sentiment === 'negative') return 'sentiment-negative';
  return 'sentiment-neutral';
}

function formatQuotePrice(value: number, currency?: string) {
  const normalized = (currency || 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL';
  const locale = normalized === 'USD' ? 'en-US' : 'pt-BR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalized,
    maximumFractionDigits: 2,
  }).format(value);
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
  if (/^[A-Z]{4}\d{1,2}$/.test(symbol) && !symbol.endsWith('.SA')) {
    candidates.push(`${symbol}.SA`);
  }

  return candidates;
}

export function DashboardTab({ token, onError }: DashboardTabProps) {
  const [loading, setLoading] = useState(true);
  const [walletCurrency, setWalletCurrency] = useState<CurrencyCode>('BRL');
  const [usdBrlRate, setUsdBrlRate] = useState(5.6);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLabels, setDetailLabels] = useState<string[]>([]);
  const [detailSeries, setDetailSeries] = useState<number[]>([]);
  const [detailTransactions, setDetailTransactions] = useState<PortfolioTransaction[]>([]);
  const [symbolCurrencyMap, setSymbolCurrencyMap] = useState<Record<string, CurrencyCode>>({});
  const [newsQuoteBySymbol, setNewsQuoteBySymbol] = useState<Record<string, {
    price: number;
    changePercent: number;
    currency?: string;
  }>>({});

  const portfolioCanvas = useRef<HTMLCanvasElement | null>(null);
  const portfolioChartRef = useRef<any>(null);
  const detailCanvas = useRef<HTMLCanvasElement | null>(null);
  const detailChartRef = useRef<any>(null);

  const [state, setState] = useState<DashboardState>({
    totalCurrent: 0,
    totalProfitLoss: 0,
    watchlistCount: 0,
    unreadAlerts: 0,
    news: [],
    positions: [],
    performance: { labels: [], values: [] },
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [portfolio, watchlist, alerts, news, performance] = await Promise.all([
          getPortfolio(token),
          getWatchlist(token),
          getAlerts(token),
          getNews(token, 5),
          getPortfolioPerformance(token, 90),
        ]);

        setState({
          totalCurrent: portfolio.summary.totalCurrent,
          totalProfitLoss: portfolio.summary.totalProfitLoss,
          watchlistCount: watchlist.length,
          unreadAlerts: alerts.filter((a) => !a.read_at).length,
          news,
          positions: portfolio.positions || [],
          performance: {
            labels: (performance || []).map((item) => new Date(item.day).toLocaleDateString()),
            values: (performance || []).map((item) => Number(item.total_value || 0)),
          },
        });

        const relatedSymbols = Array.from(
          new Set(
            news
              .flatMap((item) => item.related_stocks || [])
              .map((symbol) => symbol.toUpperCase())
          )
        ).slice(0, 10);

        if (relatedSymbols.length === 0) {
          setNewsQuoteBySymbol({});
        } else {
          const snapshots = await Promise.all(
            relatedSymbols.map(async (symbol) => {
              try {
                const quote = await getStockQuote(token, symbol);
                return [
                  symbol,
                  {
                    price: Number(quote.price || 0),
                    changePercent: Number(quote.changePercent || 0),
                    currency: quote.currency,
                  },
                ] as const;
              } catch {
                return null;
              }
            })
          );

          setNewsQuoteBySymbol(Object.fromEntries(
            snapshots.filter((entry): entry is readonly [string, { price: number; changePercent: number; currency?: string }] => Boolean(entry))
          ));
        }
      } catch (error: any) {
        onError(error.message || 'Nao foi possivel carregar o dashboard.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, onError]);

  useEffect(() => {
    const ChartLib = (window as any).Chart;
    if (!ChartLib || !portfolioCanvas.current || state.performance.values.length === 0) {
      return;
    }

    portfolioChartRef.current?.destroy();
    portfolioChartRef.current = new ChartLib(portfolioCanvas.current.getContext('2d'), {
      type: 'line',
      data: {
        labels: state.performance.labels,
        datasets: [
          {
            label: 'Evolucao da carteira',
            data: state.performance.values,
            borderColor: '#36c8ff',
            backgroundColor: 'rgba(54, 200, 255, 0.2)',
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => formatMoney(Number(context.parsed?.y ?? context.raw ?? 0), walletCurrency),
            },
          },
        },
      },
    });

    return () => {
      portfolioChartRef.current?.destroy();
      portfolioChartRef.current = null;
    };
  }, [state.performance.labels, state.performance.values, walletCurrency]);

  useEffect(() => {
    const ChartLib = (window as any).Chart;
    if (!ChartLib || !detailCanvas.current || detailSeries.length === 0 || !detailOpen) {
      return;
    }

    detailChartRef.current?.destroy();
    detailChartRef.current = new ChartLib(detailCanvas.current.getContext('2d'), {
      type: 'line',
      data: {
        labels: detailLabels,
        datasets: [
          {
            label: `${detailSymbol || 'Ativo'} rentabilidade (%)`,
            data: detailSeries,
            borderColor: '#f1c84a',
            backgroundColor: 'rgba(241, 200, 74, 0.2)',
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => `${Number(context.parsed?.y ?? context.raw ?? 0).toFixed(2)}%`,
            },
          },
        },
      },
    });

    return () => {
      detailChartRef.current?.destroy();
      detailChartRef.current = null;
    };
  }, [detailLabels, detailSeries, detailOpen, detailSymbol]);

  async function openDetails(symbol: string) {
    setDetailOpen(true);
    setDetailSymbol(symbol);
    setDetailLoading(true);
    setDetailLabels([]);
    setDetailSeries([]);

    try {
      try {
        const quote = await getStockQuote(token, symbol);
        const fromProvider = normalizeCurrency(quote.currency);
        if (fromProvider) {
          setSymbolCurrencyMap((prev) => ({ ...prev, [symbol]: fromProvider }));
        }
      } catch {
        // Keep heuristic fallback when quote lookup fails.
      }

      const now = new Date();
      const from = new Date();
      from.setDate(now.getDate() - 180);

      const txs = await getPortfolioTransactions(token, symbol);
      let normalized: { date: string; close: number }[] = [];

      for (const candidate of buildHistoryCandidates(symbol)) {
        const history = await getStockHistory(token, candidate, from.toISOString().slice(0, 10), now.toISOString().slice(0, 10));
        normalized = normalizeHistory(history);
        if (normalized.length > 1) {
          break;
        }
      }

      if (normalized.length <= 1 && txs.length > 1) {
        normalized = txs
          .map((tx) => ({ date: tx.transaction_date, close: Number(tx.purchase_price) }))
          .filter((point) => point.date && Number.isFinite(point.close) && point.close > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      if (normalized.length > 1) {
        const firstClose = normalized[0].close;
        setDetailLabels(normalized.map((point) => new Date(point.date).toLocaleDateString()));
        setDetailSeries(normalized.map((point) => ((point.close - firstClose) / firstClose) * 100));
      }

      setDetailTransactions(txs);
    } catch (error: any) {
      onError(error.message || 'Falha ao carregar detalhes do ativo.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetails() {
    setDetailOpen(false);
    setDetailSymbol(null);
    setDetailLabels([]);
    setDetailSeries([]);
    setDetailTransactions([]);
  }

  if (loading) {
    return <div className="card">Carregando dashboard...</div>;
  }

  const profitDirectionClass = state.totalProfitLoss >= 0 ? 'profit' : 'loss';
  const topMover = state.positions.reduce<PortfolioPosition | null>((best, current) => {
    if (!best) return current;
    const currentVariation = Math.abs(Number(current.dailyChange ?? current.profitLossPercent ?? 0));
    const bestVariation = Math.abs(Number(best.dailyChange ?? best.profitLossPercent ?? 0));
    return currentVariation > bestVariation ? current : best;
  }, null);

  const topMoverVariation = topMover ? Number(topMover.dailyChange ?? topMover.profitLossPercent ?? 0) : 0;

  return (
    <section className="stack-lg">
      <article className="card dashboard-hero">
        <div className="stack-xs">
          <p className="eyebrow">Resumo do dia</p>
          <h3>Painel de monitoramento</h3>
          <p className="muted tiny">
            Acompanhe performance da carteira, eventos de mercado e sinais rapidos de variacao em um unico bloco.
          </p>
        </div>
        <div className="dashboard-hero-pills">
          <span className="badge">Noticias: {state.news.length}</span>
          <span className="badge">Ativos: {state.positions.length}</span>
          {topMover && (
            <span className={`badge ${topMoverVariation >= 0 ? 'trend-positive' : 'trend-negative'}`}>
              Maior movimento: {topMover.symbol} ({topMoverVariation >= 0 ? '+' : ''}{topMoverVariation.toFixed(2)}%)
            </span>
          )}
        </div>
      </article>

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

      <div className="stats-grid">
        <article className="stat-card metric-tile">
          <span className="tiny">Valor Atual</span>
          <strong>{formatMoney(state.totalCurrent, walletCurrency)}</strong>
          <p className="muted tiny">Consolidado dos ativos em carteira.</p>
        </article>
        <article className="stat-card metric-tile">
          <span className="tiny">Lucro/Prejuizo</span>
          <strong className={profitDirectionClass}>{formatMoney(state.totalProfitLoss, walletCurrency)}</strong>
          <p className={`tiny ${profitDirectionClass}`}>
            {state.totalProfitLoss >= 0 ? 'Carteira em valorizacao.' : 'Carteira em correcao no periodo.'}
          </p>
        </article>
        <article className="stat-card metric-tile">
          <span className="tiny">Watchlist</span>
          <strong>{state.watchlistCount}</strong>
          <p className="muted tiny">Ativos em observacao ativa.</p>
        </article>
        <article className="stat-card metric-tile">
          <span className="tiny">Alertas Nao Lidos</span>
          <strong>{state.unreadAlerts}</strong>
          <p className="muted tiny">Priorize leitura para evitar sinais perdidos.</p>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="card dashboard-main-chart stack">
          <h3>Grafico do Portfolio</h3>
          <p className="muted tiny">Evolucao do valor total da carteira nos ultimos 90 dias.</p>
          <div className="chart-box">
            {state.performance.values.length > 0 ? (
              <canvas ref={portfolioCanvas} />
            ) : (
              <p className="muted">Sem dados de performance para montar o grafico.</p>
            )}
          </div>
        </article>

        <article className="card stack">
          <h3>Noticias</h3>
          <p className="muted tiny">Ultimas publicacoes relevantes para o seu monitoramento.</p>
          {state.news.length === 0 && <p className="muted">Sem noticias recentes.</p>}
          {state.news.map((item) => (
            <article key={item.id} className="list-row">
              <div className="stack-xs">
                <strong>{item.title}</strong>
                <div className="badges-row">
                  <span className={`badge ${getSentimentClass(item.sentiment)}`}>
                    {getSentimentLabel(item.sentiment)}
                  </span>
                  {item.related_stocks && item.related_stocks.length > 0 && (
                    <span className="badge">Ativo: {item.related_stocks.slice(0, 2).join(', ')}</span>
                  )}
                  {item.related_stocks?.[0] && newsQuoteBySymbol[item.related_stocks[0].toUpperCase()] && (
                    <span className={`badge ${newsQuoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent >= 0 ? 'trend-positive' : 'trend-negative'}`}>
                      {item.related_stocks[0].toUpperCase()} {newsQuoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent >= 0 ? 'valorizando' : 'caindo'} ({newsQuoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent >= 0 ? '+' : ''}{newsQuoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent.toFixed(2)}%) · {formatQuotePrice(newsQuoteBySymbol[item.related_stocks[0].toUpperCase()].price, newsQuoteBySymbol[item.related_stocks[0].toUpperCase()].currency)}
                    </span>
                  )}
                </div>
                <p className="muted tiny">{new Date(item.published_at).toLocaleString()}</p>
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              )}
            </article>
          ))}
        </article>

        <article className="card stack">
          <h3>Ativos</h3>
          <p className="muted tiny">Clique em um ativo para abrir detalhes em modal.</p>
          {state.positions.length === 0 && <p className="muted">Nenhum ativo em carteira.</p>}
          {state.positions.map((position) => (
            <article key={position.symbol} className="list-row">
              <div className="stack-xs">
                <strong>{position.symbol}</strong>
                <p className="muted tiny">
                  Qtd: {position.quantity} | Atual: {formatMoney(
                    convertCurrency(
                      position.currentPrice,
                      symbolCurrencyMap[position.symbol] || detectSymbolCurrency(position.symbol),
                      walletCurrency,
                      usdBrlRate
                    ),
                    walletCurrency
                  )}
                </p>
                <p className={`tiny ${Number(position.dailyChange ?? position.profitLossPercent ?? 0) >= 0 ? 'profit' : 'loss'}`}>
                  {Number(position.dailyChange ?? position.profitLossPercent ?? 0) >= 0 ? 'Valorizando' : 'Desvalorizando'}
                  {' '}
                  ({Number(position.dailyChange ?? position.profitLossPercent ?? 0) >= 0 ? '+' : ''}
                  {Number(position.dailyChange ?? position.profitLossPercent ?? 0).toFixed(2)}%)
                </p>
              </div>
              <button className="btn" type="button" onClick={() => openDetails(position.symbol)}>
                Ver detalhes
              </button>
            </article>
          ))}
        </article>
      </div>

      {detailOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeDetails}>
          <section className="modal-card stack" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>Detalhes de {detailSymbol}</h3>
              <button className="btn danger" type="button" onClick={closeDetails}>Fechar</button>
            </div>
            <p className="muted tiny">Historico de transacoes e grafico de rentabilidade dos ultimos 6 meses.</p>
            <p className="muted tiny">Moeda da carteira: {walletCurrency}</p>

            <div className="card chart-box">
              {detailLoading && <p className="muted">Carregando detalhes...</p>}
              {!detailLoading && detailSeries.length > 1 && <canvas ref={detailCanvas} />}
              {!detailLoading && detailSeries.length <= 1 && (
                <p className="muted">Sem historico suficiente para montar grafico de rentabilidade.</p>
              )}
            </div>

            <div className="stack">
              <h3>Transacoes</h3>
              {detailTransactions.length === 0 && <p className="muted">Sem transacoes para este ativo.</p>}
              {detailTransactions.map((tx) => (
                <article key={tx.id} className="list-row">
                  <div className="stack-xs">
                    <strong>
                      {tx.transaction_type} · {tx.quantity} @ {formatMoney(
                        convertCurrency(
                          Number(tx.purchase_price),
                          symbolCurrencyMap[detailSymbol || tx.symbol] || detectSymbolCurrency(detailSymbol || tx.symbol),
                          walletCurrency,
                          usdBrlRate
                        ),
                        walletCurrency
                      )}
                    </strong>
                    <p className="muted tiny">Data: {new Date(tx.transaction_date).toLocaleDateString()}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
