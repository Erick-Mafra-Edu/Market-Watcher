import { useEffect, useState } from 'react';
import { getAlerts, getNews, getPortfolio, getWatchlist } from '../../services/api';
import { NewsItem } from '../../types';

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
}

export function DashboardTab({ token, onError }: DashboardTabProps) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DashboardState>({
    totalCurrent: 0,
    totalProfitLoss: 0,
    watchlistCount: 0,
    unreadAlerts: 0,
    news: [],
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [portfolio, watchlist, alerts, news] = await Promise.all([
          getPortfolio(token),
          getWatchlist(token),
          getAlerts(token),
          getNews(token, 5),
        ]);

        setState({
          totalCurrent: portfolio.summary.totalCurrent,
          totalProfitLoss: portfolio.summary.totalProfitLoss,
          watchlistCount: watchlist.length,
          unreadAlerts: alerts.filter((a) => !a.read_at).length,
          news,
        });
      } catch (error: any) {
        onError(error.message || 'Nao foi possivel carregar o dashboard.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, onError]);

  if (loading) {
    return (
      <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-6 text-slate-500 text-sm animate-pulse">
        Carregando dashboard...
      </div>
    );
  }

  const plPositive = state.totalProfitLoss >= 0;

  return (
    <section className="flex flex-col gap-5">
      {/* Stats grid */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(185px,1fr))]">
        <article className="stat-card">
          <span className="text-sm text-teal-100">Valor Atual</span>
          <strong className="text-xl">${state.totalCurrent.toFixed(2)}</strong>
        </article>
        <article className="stat-card">
          <span className="text-sm text-teal-100">Lucro/Prejuizo</span>
          <strong className={`text-xl ${plPositive ? 'text-emerald-200' : 'text-red-300'}`}>
            {plPositive ? '+' : ''}${state.totalProfitLoss.toFixed(2)}
          </strong>
        </article>
        <article className="stat-card">
          <span className="text-sm text-teal-100">Watchlist</span>
          <strong className="text-xl">{state.watchlistCount}</strong>
        </article>
        <article className="stat-card">
          <span className="text-sm text-teal-100">Alertas Nao Lidos</span>
          <strong className="text-xl">{state.unreadAlerts}</strong>
        </article>
      </div>

      {/* Recent news */}
      <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-3">
        <div>
          <h3 className="font-heading font-bold text-slate-800">Noticias Recentes</h3>
          <p className="text-xs text-slate-400 mt-0.5">Ultimas publicacoes relevantes para o seu monitoramento.</p>
        </div>
        {state.news.length === 0 && <p className="text-sm text-slate-400">Sem noticias recentes.</p>}
        {state.news.map((item) => (
          <article
            key={item.id}
            className="border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white/70 hover:bg-white transition"
          >
            <div>
              <strong className="text-sm text-slate-800">{item.title}</strong>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(item.published_at).toLocaleString()}</p>
            </div>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#0a5f53] underline-offset-2 hover:underline whitespace-nowrap"
              >
                Abrir
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
