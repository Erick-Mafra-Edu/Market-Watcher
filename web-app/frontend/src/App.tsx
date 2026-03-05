import { useCallback, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuthView } from './components/AuthView';
import { AlertsTab } from './components/tabs/AlertsTab';
import { ChartsTab } from './components/tabs/ChartsTab';
import { DashboardTab } from './components/tabs/DashboardTab';
import { NewsTab } from './components/tabs/NewsTab';
import { PortfolioTab } from './components/tabs/PortfolioTab';
import { WatchlistTab } from './components/tabs/WatchlistTab';
import { TabKey, User } from './types';

type MessageType = 'success' | 'error' | 'info';

interface MessageState {
  text: string;
  type: MessageType;
}

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [message, setMessage] = useState<MessageState | null>(null);

  const showMessage = useCallback((text: string, type: MessageType) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const handleAuth = useCallback((nextToken: string, nextUser: User) => {
    localStorage.setItem('token', nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
    showMessage('Sessao encerrada.', 'info');
  }, [showMessage]);

  const currentTab = useMemo(() => {
    if (!token) return null;

    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab token={token} onError={(msg) => showMessage(msg, 'error')} />;
      case 'news':
        return <NewsTab token={token} onError={(msg) => showMessage(msg, 'error')} />;
      case 'portfolio':
        return <PortfolioTab token={token} onNotify={showMessage} />;
      case 'watchlist':
        return <WatchlistTab token={token} onNotify={showMessage} />;
      case 'charts':
        return <ChartsTab token={token} onNotify={showMessage} />;
      case 'alerts':
        return <AlertsTab token={token} onNotify={showMessage} />;
      default:
        return null;
    }
  }, [activeTab, token, showMessage]);

  return (
    <main className="container">
      {message && <div className={`flash ${message.type}`}>{message.text}</div>}

      {!token && <AuthView onAuthenticated={handleAuth} onMessage={showMessage} />}

      {token && (
        <AppShell user={user} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>
          {currentTab}
        </AppShell>
      )}
    </main>
  );
}
