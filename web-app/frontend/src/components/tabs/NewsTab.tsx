import { useEffect, useState } from 'react';
import { getNews } from '../../services/api';
import { NewsItem } from '../../types';

interface NewsTabProps {
  token: string;
  onError: (message: string) => void;
}

const sentimentBadge: Record<string, string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
};

export function NewsTab({ token, onError }: NewsTabProps) {
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    getNews(token)
      .then(setItems)
      .catch((error: any) => onError(error.message || 'Falha ao carregar noticias.'));
  }, [token, onError]);

  return (
    <section className="bg-white/90 rounded-2xl border border-slate-200 shadow-md p-5 backdrop-blur-sm flex flex-col gap-4">
      <div>
        <h3 className="font-heading font-bold text-slate-800">Noticias de Mercado</h3>
        <p className="text-xs text-slate-400 mt-0.5">Acompanhe o fluxo de noticias e abra a fonte original quando necessario.</p>
      </div>

      {items.length === 0 && <p className="text-sm text-slate-400">Nenhuma noticia encontrada.</p>}

      {items.map((item) => (
        <article
          key={item.id}
          className="border border-slate-100 rounded-xl px-4 py-3 flex items-start justify-between gap-3 bg-white/70 hover:bg-white transition"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-sm text-slate-800">{item.title}</strong>
              {item.sentiment && (
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${sentimentBadge[item.sentiment] ?? sentimentBadge.neutral}`}>
                  {item.sentiment}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
            )}
            <small className="text-xs text-slate-400">
              {item.source || 'Fonte desconhecida'} &middot; {new Date(item.published_at).toLocaleString()}
            </small>
          </div>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-[#0a5f53] underline-offset-2 hover:underline whitespace-nowrap mt-0.5"
            >
              Abrir fonte
            </a>
          )}
        </article>
      ))}
    </section>
  );
}
