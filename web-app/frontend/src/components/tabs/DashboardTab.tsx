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
    return <div className="card">Carregando dashboard...</div>;
  }

  return (
    <section className="stack-lg">
      <div className="stats-grid">
        <article className="stat-card">
          <span>Valor Atual</span>
          <strong>${state.totalCurrent.toFixed(2)}</strong>
        </article>
        <article className="stat-card">
          <span>Lucro/Prejuizo</span>
          <strong>${state.totalProfitLoss.toFixed(2)}</strong>
        </article>
        <article className="stat-card">
          <span>Watchlist</span>
          <strong>{state.watchlistCount}</strong>
        </article>
        <article className="stat-card">
          <span>Alertas Nao Lidos</span>
          <strong>{state.unreadAlerts}</strong>
        </article>
      </div>

      <div className="card stack">
        <h3>Noticias Recentes</h3>
        <p className="muted tiny">Ultimas publicacoes relevantes para o seu monitoramento.</p>
        {state.news.length === 0 && <p className="muted">Sem noticias recentes.</p>}
        {state.news.map((item) => (
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
    </section>
  );
}
