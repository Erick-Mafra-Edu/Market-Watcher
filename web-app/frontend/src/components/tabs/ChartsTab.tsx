import { FormEvent, useEffect, useRef, useState } from 'react';
import { getStockHistory, getStockQuote, getWatchlist } from '../../services/api';

type ChartPoint = {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
};

type CurrencyCode = 'BRL' | 'USD';

interface ChartsTabProps {
  token: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

function normalizePoint(point: any): ChartPoint {
  const date = point.date || point.datetime || point.timestamp;
  const close = Number(point.close ?? point.price ?? 0);
  const open = Number(point.open ?? close);
  const high = Number(point.high ?? close);
  const low = Number(point.low ?? close);
  const volume = Number(point.volume ?? 0);
  return { date, open, close, high, low, volume };
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
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

export function ChartsTab({ token, onNotify }: ChartsTabProps) {
  const [symbol, setSymbol] = useState('');
  const [period1, setPeriod1] = useState('');
  const [period2, setPeriod2] = useState('');
  const [quick, setQuick] = useState<string[]>([]);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [sourceCurrency, setSourceCurrency] = useState<CurrencyCode>('USD');
  const [walletCurrency, setWalletCurrency] = useState<CurrencyCode>('BRL');
  const [usdBrlRate, setUsdBrlRate] = useState(5.6);
  const [summary, setSummary] = useState<{ last: number; variation: number; high: number; low: number; avgVolume: number } | null>(null);

  const priceCanvas = useRef<HTMLCanvasElement | null>(null);
  const volumeCanvas = useRef<HTMLCanvasElement | null>(null);
  const chartsRef = useRef<{ price?: any; volume?: any }>({});

  useEffect(() => {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 90);

    setPeriod1(from.toISOString().slice(0, 10));
    setPeriod2(now.toISOString().slice(0, 10));

    getWatchlist(token)
      .then((items) => {
        const symbols = items.map((i) => i.symbol).slice(0, 8);
        setQuick(symbols);
        if (symbols.length > 0) {
          setSymbol(symbols[0]);
        }
      })
      .catch(() => {
        setSymbol('AAPL');
      });
  }, [token]);

  async function loadChart(event?: FormEvent) {
    event?.preventDefault();

    if (!symbol || !period1 || !period2) {
      onNotify('Informe simbolo e intervalo de datas.', 'error');
      return;
    }

    try {
      const raw = await getStockHistory(token, symbol, period1, period2);
      const normalized = raw
        .map(normalizePoint)
        .filter((p) => p.date && Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (normalized.length === 0) {
        setSummary(null);
        setPoints([]);
        onNotify('Sem historico para o simbolo informado.', 'info');
        return;
      }

      let detectedCurrency = detectSymbolCurrency(symbol);
      try {
        const quote = await getStockQuote(token, symbol);
        detectedCurrency = normalizeCurrency(quote.currency) ?? detectedCurrency;
      } catch {
        // Keep heuristic fallback when quote lookup fails.
      }

      setSourceCurrency(detectedCurrency);
      setPoints(normalized);
    } catch (error: any) {
      onNotify(error.message || 'Falha ao carregar grafico.', 'error');
    }
  }

  useEffect(() => {
    if (points.length === 0) {
      chartsRef.current.price?.destroy();
      chartsRef.current.volume?.destroy();
      chartsRef.current.price = undefined;
      chartsRef.current.volume = undefined;
      return;
    }

    const converted = points.map((point) => ({
      ...point,
      open: convertCurrency(point.open, sourceCurrency, walletCurrency, usdBrlRate),
      close: convertCurrency(point.close, sourceCurrency, walletCurrency, usdBrlRate),
      high: convertCurrency(point.high, sourceCurrency, walletCurrency, usdBrlRate),
      low: convertCurrency(point.low, sourceCurrency, walletCurrency, usdBrlRate),
    }));

    const labels = converted.map((p) => new Date(p.date).toLocaleDateString());
    const closes = converted.map((p) => p.close);
    const opens = converted.map((p) => p.open);
    const volumes = converted.map((p) => p.volume);

    const first = converted[0];
    const last = converted[converted.length - 1];
    setSummary({
      last: last.close,
      variation: ((last.close - first.close) / first.close) * 100,
      high: Math.max(...converted.map((p) => p.high)),
      low: Math.min(...converted.map((p) => p.low)),
      avgVolume: converted.reduce((sum, p) => sum + p.volume, 0) / converted.length,
    });

    const ChartLib = (window as any).Chart;
    if (!ChartLib || !priceCanvas.current || !volumeCanvas.current) {
      return;
    }

    chartsRef.current.price?.destroy();
    chartsRef.current.volume?.destroy();

    chartsRef.current.price = new ChartLib(priceCanvas.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: `${symbol} close`, data: closes, borderColor: '#1f6d5a', backgroundColor: 'rgba(31, 109, 90, 0.2)', fill: true, pointRadius: 0 },
          { label: `${symbol} open`, data: opens, borderColor: '#7a8a99', fill: false, pointRadius: 0 },
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
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const datasetLabel = context.dataset.label || '';
                const value = Number(context.parsed?.y ?? context.raw ?? 0);
                return `${datasetLabel}: ${formatMoney(value, walletCurrency)}`;
              },
            },
          },
        },
      },
    });

    chartsRef.current.volume = new ChartLib(volumeCanvas.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Volume', data: volumes, backgroundColor: 'rgba(237, 139, 65, 0.45)', borderColor: '#ed8b41', borderWidth: 1 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = Number(context.parsed?.y ?? context.raw ?? 0);
                return `Volume: ${compact(value)}`;
              },
            },
          },
        },
      },
    });
  }, [points, sourceCurrency, walletCurrency, usdBrlRate, symbol]);

  return (
    <section className="stack-lg">
      <form className="card form-grid-4" onSubmit={loadChart}>
        <h3>Grafico Historico</h3>
        <p className="muted tiny">Compare movimento de preco e volume no periodo escolhido.</p>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="Simbolo" required />
        <input type="date" value={period1} onChange={(e) => setPeriod1(e.target.value)} required />
        <input type="date" value={period2} onChange={(e) => setPeriod2(e.target.value)} required />
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
        <button className="btn btn-primary" type="submit">Atualizar</button>
      </form>

      {quick.length > 0 && (
        <div className="quick-row">
          {quick.map((item) => (
            <button key={item} className="btn" type="button" onClick={() => setSymbol(item)}>
              {item}
            </button>
          ))}
        </div>
      )}

      <p className="muted tiny">
        Moeda de origem detectada para <strong>{symbol || '-'}</strong>: {sourceCurrency}. Exibindo em carteira {walletCurrency}.
      </p>

      {summary && (
        <div className="stats-grid">
          <article className="stat-card"><span>Ultimo Fechamento</span><strong>{formatMoney(summary.last, walletCurrency)}</strong></article>
          <article className="stat-card"><span>Variacao do Periodo</span><strong>{summary.variation.toFixed(2)}%</strong></article>
          <article className="stat-card"><span>Maximo / Minimo</span><strong>{formatMoney(summary.high, walletCurrency)} / {formatMoney(summary.low, walletCurrency)}</strong></article>
          <article className="stat-card"><span>Volume Medio</span><strong>{compact(summary.avgVolume)}</strong></article>
        </div>
      )}

      <div className="card chart-box"><canvas ref={priceCanvas} /></div>
      <div className="card chart-box"><canvas ref={volumeCanvas} /></div>
    </section>
  );
}
