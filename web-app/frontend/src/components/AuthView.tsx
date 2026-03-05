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
        onMessage('Cadastro realizado. Faca login para continuar.', 'success');
        setMode('login');
      }
    } catch (error: any) {
      onMessage(error.message || 'Falha na autenticacao.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-48px)] grid place-items-center">
      <div className="w-full max-w-[520px] animate-rise-in">
        {/* Logo / brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] shadow-lg shadow-teal-200/60 mb-3">
            <span className="text-2xl">📈</span>
          </div>
          <p className="uppercase tracking-widest text-xs font-bold text-slate-400 mb-1">Plataforma de monitoramento</p>
          <h1 className="font-heading text-3xl font-extrabold text-slate-800 tracking-tight">Market Watcher</h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe cotacoes, noticias, portfolio e alertas em um unico fluxo.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-xl p-6 backdrop-blur-sm">
          {/* Mode tabs */}
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={
                mode === 'login'
                  ? 'flex-1 py-2 rounded-xl font-semibold text-sm cursor-pointer transition-all bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] text-white border-transparent shadow-md shadow-teal-200/50'
                  : 'flex-1 py-2 rounded-xl font-semibold text-sm cursor-pointer transition-all border border-slate-200 bg-white text-slate-600 hover:border-[#0f7b6c]'
              }
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={
                mode === 'register'
                  ? 'flex-1 py-2 rounded-xl font-semibold text-sm cursor-pointer transition-all bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] text-white border-transparent shadow-md shadow-teal-200/50'
                  : 'flex-1 py-2 rounded-xl font-semibold text-sm cursor-pointer transition-all border border-slate-200 bg-white text-slate-600 hover:border-[#0f7b6c]'
              }
            >
              Cadastro
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Nome</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30 focus:border-[#0f7b6c] transition"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@email.com"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30 focus:border-[#0f7b6c] transition"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0f7b6c]/30 focus:border-[#0f7b6c] transition"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-br from-[#0f7b6c] to-[#0a5f53] shadow-md shadow-teal-200/50 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              {mode === 'login'
                ? 'Use seu acesso para visualizar dashboard, watchlist e alertas personalizados.'
                : 'Crie sua conta para salvar ativos, registrar transacoes e receber notificacoes.'}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
