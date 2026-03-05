import { useEffect, useState } from 'react';
import { getNews, getStockQuote } from '../../services/api';
import { NewsItem } from '../../types';

interface NewsTabProps {
  token: string;
  onError: (message: string) => void;
}

export function NewsTab({ token, onError }: NewsTabProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteBySymbol, setQuoteBySymbol] = useState<Record<string, {
    price: number;
    changePercent: number;
    currency?: string;
  }>>({});

  function normalizeRelatedStocks(item: NewsItem): string[] {
    return (item.related_stocks || []).map((symbol) => symbol.toUpperCase());
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
              .flatMap((item) => normalizeRelatedStocks(item))
          )
        )
          .filter((symbol) => /^(?:[A-Z]{1,5}|[A-Z]{1,5}\.SA|[A-Z]{4}\d{1,2}(?:\.SA)?)$/.test(symbol))
          .slice(0, 20);

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

  const assetOptions = Array.from(
    new Set(items.flatMap((item) => normalizeRelatedStocks(item)))
  ).sort();

  const filteredItems = items.filter((item) => {
    const matchesSentiment = sentimentFilter === 'all' || (item.sentiment || 'neutral') === sentimentFilter;
    const relatedSymbols = normalizeRelatedStocks(item);
    const matchesAsset = assetFilter === 'all' || relatedSymbols.includes(assetFilter);
    const searchable = `${item.title} ${item.description || ''} ${item.source || ''}`.toLowerCase();
    const matchesSearch = !searchTerm.trim() || searchable.includes(searchTerm.trim().toLowerCase());

    return matchesSentiment && matchesAsset && matchesSearch;
  });

  return (
    <section className="card stack">
      <h3>Noticias de Mercado</h3>
      <p className="muted tiny">Acompanhe o fluxo de noticias e abra a fonte original quando necessario.</p>
      <div className="form-grid-4">
        <label className="field stack-xs">
          <span className="tiny muted">Sentimento</span>
          <select
            value={sentimentFilter}
            onChange={(event) => setSentimentFilter(event.target.value as 'all' | 'positive' | 'neutral' | 'negative')}
          >
            <option value="all">Todos</option>
            <option value="positive">Positivas</option>
            <option value="neutral">Neutras</option>
            <option value="negative">Negativas</option>
          </select>
        </label>

        <label className="field stack-xs">
          <span className="tiny muted">Ativo relacionado</span>
          <select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}>
            <option value="all">Todos os ativos</option>
            {assetOptions.map((symbol) => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </label>

        <label className="field stack-xs">
          <span className="tiny muted">Buscar</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Titulo, descricao ou fonte"
          />
        </label>
      </div>

      {items.length === 0 && <p className="muted">Nenhuma noticia encontrada.</p>}
      {items.length > 0 && filteredItems.length === 0 && (
        <p className="muted">Nenhuma noticia encontrada com os filtros atuais.</p>
      )}
      {filteredItems.map((item) => {
        const relatedAssets = normalizeRelatedStocks(item);
        const primaryAsset = relatedAssets[0];
        return (
        <article key={item.id} className="list-row">
          <div className="stack-xs">
            <strong>{item.title}</strong>
            <p>{item.description || 'Sem descricao.'}</p>
            <div className="badges-row">
              <span className={`badge ${getSentimentClass(item.sentiment)}`}>
                Sentimento: {getSentimentLabel(item.sentiment)}
              </span>
              {relatedAssets.length > 0 ? relatedAssets.map((symbol) => (
                <span key={`${item.id}-${symbol}`} className="badge">Ativo: {symbol}</span>
              )) : (
                <span className="badge">Ativo: nao identificado</span>
              )}
              {primaryAsset && quoteBySymbol[primaryAsset] && (
                <span
                  className={`badge ${quoteBySymbol[primaryAsset].changePercent >= 0 ? 'trend-positive' : 'trend-negative'}`}
                >
                  {primaryAsset} {quoteBySymbol[primaryAsset].changePercent >= 0 ? 'valorizando' : 'caindo'} ({quoteBySymbol[primaryAsset].changePercent >= 0 ? '+' : ''}{quoteBySymbol[primaryAsset].changePercent.toFixed(2)}%) · {formatPrice(quoteBySymbol[primaryAsset].price, quoteBySymbol[primaryAsset].currency)}
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
      );
      })}
    </section>
  );
}
