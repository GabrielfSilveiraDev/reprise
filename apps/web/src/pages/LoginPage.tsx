import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Auth } from '../api/auth';
import './LoginPage.css';

/**
 * Entrar ou criar conta.
 *
 * Um formulário de verdade, com `<form>` e `type="submit"`: é o que faz Enter funcionar, o que os
 * gerenciadores de senha reconhecem e o que o leitor de tela anuncia como formulário. Um `<div>`
 * com botão que escuta clique parece igual e não é nenhuma dessas coisas.
 */
export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const qc = useQueryClient();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await Auth.login(email.trim(), password);
      else await Auth.register(email.trim(), password, displayName.trim());

      // A sessão trocou: o cache de quem estava antes não vale mais nada.
      await qc.invalidateQueries();
      onSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não deu para entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login__panel">
        <header className="login__head">
          <p className="login__wordmark">Reprise</p>
          <p className="login__tagline">Uma exibição é um evento, não um booleano.</p>
        </header>

        <form className="login__form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">E-mail</span>
            <input
              className="field__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          {mode === 'register' ? (
            <label className="field">
              <span className="field__label">Como quer ser chamado</span>
              <input
                className="field__input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label className="field">
            <span className="field__label">Senha</span>
            <input
              className="field__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={10}
              required
            />
            {mode === 'register' ? (
              <span className="field__hint">Mínimo de 10 caracteres.</span>
            ) : null}
          </label>

          {/* `role="alert"` para o leitor de tela anunciar o erro sem o usuário ir procurá-lo. */}
          {error ? (
            <p className="login__error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="btn btn--primary login__submit" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          className="btn btn--quiet login__switch"
          type="button"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setError(null);
          }}
        >
          {mode === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  );
}
