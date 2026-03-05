import { FormEvent, useState } from 'react';
import { login, register } from '../services/api';
import { User } from '../types';

interface AuthViewProps {
  onAuthenticated: (token: string, user: User) => void;
  onMessage: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function AuthView({ onAuthenticated, onMessage }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await login(email, password);
        onAuthenticated(data.token, data.user);
        onMessage('Login realizado com sucesso.', 'success');
      } else {
        await register(name, email, password);
        onMessage('Cadastro realizado. Faça login para continuar.', 'success');
        setMode('login');
      }
    } catch (error: any) {
      onMessage(error.message || 'Falha na autenticação.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="panel card">
        <p className="eyebrow">Plataforma de monitoramento</p>
        <h1>Market Watcher</h1>
        <p className="muted">Acompanhe cotacoes, noticias, portfolio e alertas em um unico fluxo.</p>

        <div className="tab-row">
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
            Login
          </button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>
            Cadastro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          {mode === 'register' && (
            <label className="stack">
              <span>Nome</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </label>
          )}

          <label className="stack">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="voce@email.com"
            />
          </label>

          <label className="stack">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="********"
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          <p className="muted tiny">
            {mode === 'login'
              ? 'Use seu acesso para visualizar dashboard, watchlist e alertas personalizados.'
              : 'Crie sua conta para salvar ativos, registrar transacoes e receber notificacoes.'}
          </p>
        </form>
      </div>
    </section>
  );
}
