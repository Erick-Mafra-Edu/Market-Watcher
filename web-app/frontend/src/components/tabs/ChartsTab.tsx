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

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30 focus:border-[#0f7b6c] transition';

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
    <section className="flex flex-col gap-5">
      {/* Controls */}
      <form
        className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-4"
        onSubmit={loadChart}
      >
        <div>
          <h3 className="font-heading font-bold text-slate-800">Grafico Historico</h3>
          <p className="text-xs text-slate-400 mt-0.5">Compare movimento de preco e volume no periodo escolhido.</p>
        </div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(165px,1fr))]">
          <input
            className={inputCls}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Simbolo"
            required
          />
          <input className={inputCls} type="date" value={period1} onChange={(e) => setPeriod1(e.target.value)} required />
          <input className={inputCls} type="date" value={period2} onChange={(e) => setPeriod2(e.target.value)} required />
          <button
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] shadow-md shadow-teal-200/40 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            type="submit"
          >
            Atualizar
          </button>
        </div>
      </form>

      {/* Quick symbol shortcuts */}
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quick.map((item) => (
            <button
              key={item}
              onClick={() => setSymbol(item)}
              className={`px-3 py-1.5 rounded-xl font-semibold text-xs cursor-pointer transition-all duration-150 border ${
                symbol === item
                  ? 'bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] text-white border-transparent shadow-md shadow-teal-200/40'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[#0f7b6c]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {summary && (
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(185px,1fr))]">
          <article className="stat-card">
            <span className="text-sm text-teal-100">Ultimo Fechamento</span>
            <strong>${summary.last.toFixed(2)}</strong>
          </article>
          <article className="stat-card">
            <span className="text-sm text-teal-100">Variacao do Periodo</span>
            <strong className={summary.variation >= 0 ? 'text-emerald-200' : 'text-red-300'}>
              {summary.variation >= 0 ? '+' : ''}{summary.variation.toFixed(2)}%
            </strong>
          </article>
          <article className="stat-card">
            <span className="text-sm text-teal-100">Maximo / Minimo</span>
            <strong>${summary.high.toFixed(2)} / ${summary.low.toFixed(2)}</strong>
          </article>
          <article className="stat-card">
            <span className="text-sm text-teal-100">Volume Medio</span>
            <strong>{compact(summary.avgVolume)}</strong>
          </article>
        </div>
      )}

      {/* Charts */}
      <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm h-80">
        <canvas ref={priceCanvas} />
      </div>
      <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm h-48">
        <canvas ref={volumeCanvas} />
      </div>
    </section>
  );
}
