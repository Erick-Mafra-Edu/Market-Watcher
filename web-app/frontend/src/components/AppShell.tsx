import { ReactNode } from 'react';
import { TabKey, User } from '../types';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'news', label: 'Noticias', icon: '📰' },
  { key: 'portfolio', label: 'Portfolio', icon: '💼' },
  { key: 'watchlist', label: 'Watchlist', icon: '👁' },
  { key: 'charts', label: 'Graficos', icon: '📈' },
  { key: 'alerts', label: 'Alertas', icon: '🔔' },
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
    <div className="flex flex-col animate-rise-in">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 mb-4 rounded-2xl bg-white/90 border border-slate-200 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-0.5">
          <p className="uppercase tracking-widest text-xs font-bold text-slate-500">Market intelligence cockpit</p>
          <h1 className="font-heading text-2xl font-extrabold text-slate-800 tracking-tight">Market Watcher</h1>
          <p className="text-sm text-slate-500">
            Bem-vindo{user?.name ? `, ${user.name}` : ''}
          </p>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 rounded-xl font-semibold text-sm border border-slate-300 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-400 transition-all duration-150 cursor-pointer"
        >
          Sair
        </button>
      </header>

      {/* Tab navigation */}
      <nav
        className="flex gap-2 flex-wrap mb-4 p-3 rounded-2xl bg-white/80 border border-slate-200 shadow-sm"
        aria-label="Navegacao principal"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={
              activeTab === tab.key
                ? 'flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-150 bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] text-white border-transparent shadow-lg shadow-teal-200/60'
                : 'flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-150 border border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-[#0f7b6c]'
            }
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {children}
    </div>
  );
}
