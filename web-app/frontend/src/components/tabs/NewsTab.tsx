import { useEffect, useState } from 'react';
import { getNews, getStockQuote } from '../../services/api';
import { NewsItem } from '../../types';

interface NewsTabProps {
  token: string;
  onError: (message: string) => void;
}

export function NewsTab({ token, onError }: NewsTabProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [quoteBySymbol, setQuoteBySymbol] = useState<Record<string, {
    price: number;
    changePercent: number;
    currency?: string;
  }>>({});

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

  function formatPrice(value: number, currency?: string) {
    const normalized = (currency || 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL';
    const locale = normalized === 'USD' ? 'en-US' : 'pt-BR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalized,
      maximumFractionDigits: 2,
    }).format(value);
  }

  useEffect(() => {
    async function load() {
      try {
        const news = await getNews(token);
        setItems(news);

        const relatedSymbols = Array.from(
          new Set(
            news
              .flatMap((item) => item.related_stocks || [])
              .map((symbol) => symbol.toUpperCase())
          )
        ).slice(0, 20);

        if (relatedSymbols.length === 0) {
          setQuoteBySymbol({});
          return;
        }

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

        setQuoteBySymbol(Object.fromEntries(snapshots.filter((entry): entry is readonly [string, { price: number; changePercent: number; currency?: string }] => Boolean(entry))));
      } catch (error: any) {
        onError(error.message || 'Falha ao carregar noticias.');
      }
    }

    load();
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
            <div className="badges-row">
              <span className={`badge ${getSentimentClass(item.sentiment)}`}>
                Sentimento: {getSentimentLabel(item.sentiment)}
              </span>
              {item.related_stocks && item.related_stocks.length > 0 && (
                <span className="badge">
                  Ativo: {item.related_stocks.slice(0, 2).join(', ')}
                </span>
              )}
              {item.related_stocks?.[0] && quoteBySymbol[item.related_stocks[0].toUpperCase()] && (
                <span
                  className={`badge ${quoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent >= 0 ? 'trend-positive' : 'trend-negative'}`}
                >
                  {item.related_stocks[0].toUpperCase()} {quoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent >= 0 ? 'valorizando' : 'caindo'} ({quoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent >= 0 ? '+' : ''}{quoteBySymbol[item.related_stocks[0].toUpperCase()].changePercent.toFixed(2)}%) · {formatPrice(quoteBySymbol[item.related_stocks[0].toUpperCase()].price, quoteBySymbol[item.related_stocks[0].toUpperCase()].currency)}
                </span>
              )}
            </div>
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
