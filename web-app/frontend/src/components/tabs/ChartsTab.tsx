import { FormEvent, useEffect, useRef, useState } from 'react';
import { getStockHistory, getWatchlist } from '../../services/api';

type ChartPoint = {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
};

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

export function ChartsTab({ token, onNotify }: ChartsTabProps) {
  const [symbol, setSymbol] = useState('');
  const [period1, setPeriod1] = useState('');
  const [period2, setPeriod2] = useState('');
  const [quick, setQuick] = useState<string[]>([]);
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
      const points = raw
        .map(normalizePoint)
        .filter((p) => p.date && Number.isFinite(p.close) && p.close > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (points.length === 0) {
        setSummary(null);
        onNotify('Sem historico para o simbolo informado.', 'info');
        return;
      }

      const labels = points.map((p) => new Date(p.date).toLocaleDateString());
      const closes = points.map((p) => p.close);
      const opens = points.map((p) => p.open);
      const volumes = points.map((p) => p.volume);

      const first = points[0];
      const last = points[points.length - 1];
      setSummary({
        last: last.close,
        variation: ((last.close - first.close) / first.close) * 100,
        high: Math.max(...points.map((p) => p.high)),
        low: Math.min(...points.map((p) => p.low)),
        avgVolume: points.reduce((sum, p) => sum + p.volume, 0) / points.length,
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
        options: { responsive: true, maintainAspectRatio: false },
      });

      chartsRef.current.volume = new ChartLib(volumeCanvas.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Volume', data: volumes, backgroundColor: 'rgba(237, 139, 65, 0.45)', borderColor: '#ed8b41', borderWidth: 1 }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    } catch (error: any) {
      onNotify(error.message || 'Falha ao carregar grafico.', 'error');
    }
  }

  return (
    <section className="stack-lg">
      <form className="card form-grid-4" onSubmit={loadChart}>
        <h3>Grafico Historico</h3>
        <p className="muted tiny">Compare movimento de preco e volume no periodo escolhido.</p>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="Simbolo" required />
        <input type="date" value={period1} onChange={(e) => setPeriod1(e.target.value)} required />
        <input type="date" value={period2} onChange={(e) => setPeriod2(e.target.value)} required />
        <button className="btn btn-primary" type="submit">Atualizar</button>
      </form>

      {quick.length > 0 && (
        <div className="quick-row">
          {quick.map((item) => (
            <button key={item} className="btn" onClick={() => setSymbol(item)}>
              {item}
            </button>
          ))}
        </div>
      )}

      {summary && (
        <div className="stats-grid">
          <article className="stat-card"><span>Ultimo Fechamento</span><strong>${summary.last.toFixed(2)}</strong></article>
          <article className="stat-card"><span>Variacao do Periodo</span><strong>{summary.variation.toFixed(2)}%</strong></article>
          <article className="stat-card"><span>Maximo / Minimo</span><strong>${summary.high.toFixed(2)} / ${summary.low.toFixed(2)}</strong></article>
          <article className="stat-card"><span>Volume Medio</span><strong>{compact(summary.avgVolume)}</strong></article>
        </div>
      )}

      <div className="card chart-box"><canvas ref={priceCanvas} /></div>
      <div className="card chart-box"><canvas ref={volumeCanvas} /></div>
    </section>
  );
}
