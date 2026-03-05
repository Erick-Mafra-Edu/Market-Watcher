import { useEffect, useState } from 'react';
import { getNews } from '../../services/api';
import { NewsItem } from '../../types';

interface NewsTabProps {
  token: string;
  onError: (message: string) => void;
}

export function NewsTab({ token, onError }: NewsTabProps) {
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    getNews(token)
      .then(setItems)
      .catch((error: any) => onError(error.message || 'Falha ao carregar noticias.'));
  }, [token, onError]);

  return (
    <section className="card stack">
      <h3>Noticias de Mercado</h3>
      <p className="muted tiny">Acompanhe o fluxo de noticias e abra a fonte original quando necessario.</p>
      {items.length === 0 && <p className="muted">Nenhuma noticia encontrada.</p>}
      {items.map((item) => (
        <article key={item.id} className="list-row">
          <div className="stack-xs">
            <strong>{item.title}</strong>
            <p>{item.description || 'Sem descricao.'}</p>
            <small className="muted">{item.source || 'Fonte desconhecida'} · {new Date(item.published_at).toLocaleString()}</small>
          </div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer">
              Abrir fonte
            </a>
          )}
        </article>
      ))}
    </section>
  );
}
