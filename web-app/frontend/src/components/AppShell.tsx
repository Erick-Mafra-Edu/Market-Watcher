import { ReactNode } from 'react';
import { TabKey, User } from '../types';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'news', label: 'Noticias' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'dividends', label: 'Dividendos' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'charts', label: 'Graficos' },
  { key: 'alerts', label: 'Alertas' },
];

interface AppShellProps {
  user: User | null;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ user, activeTab, onTabChange, onLogout, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar card">
        <div className="brand-block stack-xs">
          <p className="eyebrow">Market intelligence cockpit</p>
          <div className="title-row">
            <h1>Market Watcher</h1>
            <span className="chip">Realtime</span>
          </div>
          <p className="muted">Bem-vindo{user?.name ? `, ${user.name}` : ''}</p>
        </div>
        <button className="btn danger" onClick={onLogout}>
          Sair
        </button>
      </header>

      <nav className="tab-row card" aria-label="Navegacao principal">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {children}
    </div>
  );
}
