import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Auth } from '../api/auth';
import './LoginPage.css';

/** Entrar · criar conta · digitar o código que valida a conta recém-criada. */
type Step = 'login' | 'register' | 'confirm';

/**
 * Autenticação. Espelha o app: mesmos passos, mesmos rótulos, mesmas mensagens.
 *
 * Um `<form>` de verdade, com `type="submit"`: é o que faz Enter funcionar, o que os
 * gerenciadores de senha reconhecem e o que o leitor de tela anuncia como formulário. Um `<div>`
 * com botão que escuta clique parece igual e não é nenhuma dessas coisas.
 */
export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === 'login') {
        await Auth.login(identifier.trim(), password);
      } else if (step === 'register') {
        const r = await Auth.register(email.trim(), password, displayName.trim(), identifier.trim());
        setInfo(r.message);
        setStep('confirm');
        return;
      } else {
        await Auth.confirm(email.trim(), code.trim());
      }

      // A sessão trocou: o cache de quem estava antes não vale mais nada.
      await qc.invalidateQueries();
      onSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não deu para continuar.');
    } finally {
      setBusy(false);
    }
  };

  const rotulo = step === 'login' ? 'Entrar' : step === 'register' ? 'Criar conta' : 'Validar conta';

  return (
    <div className="login">
      <div className="login__panel">
        <header className="login__head">
          <p className="login__wordmark">Reprise</p>
          <p className="login__tagline">Uma exibição é um evento, não um booleano.</p>
        </header>

        <form className="login__form" onSubmit={submit}>
          {step === 'confirm' ? (
            <>
              {info ? <p className="login__info">{info}</p> : null}

              <label className="field">
                <span className="field__label">Código de seis dígitos</span>
                <input
                  className="field__input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <span className="field__hint">Enviado para {email}.</span>
              </label>

              <button
                className="btn btn--quiet login__switch"
                type="button"
                onClick={async () => {
                  await Auth.resend(email.trim());
                  setInfo('Código reenviado.');
                }}
              >
                Reenviar código
              </button>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field__label">
                  {step === 'login' ? 'Usuário ou e-mail' : 'Nome de usuário'}
                </span>
                <input
                  className="field__input"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              {step === 'register' ? (
                <>
                  <label className="field">
                    <span className="field__label">E-mail</span>
                    <input
                      className="field__input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>

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
                </>
              ) : null}

              <label className="field">
                <span className="field__label">Senha</span>
                <input
                  className="field__input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={step === 'login' ? 'current-password' : 'new-password'}
                  minLength={10}
                  required
                />
                {step === 'register' ? (
                  <span className="field__hint">Mínimo de 10 caracteres.</span>
                ) : null}
              </label>
            </>
          )}

          {/* `role="alert"` para o leitor de tela anunciar o erro sem o usuário ir procurá-lo. */}
          {error ? (
            <p className="login__error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="btn btn--primary login__submit" type="submit" disabled={busy}>
            {busy ? 'Um momento…' : rotulo}
          </button>
        </form>

        <button
          className="btn btn--quiet login__switch"
          type="button"
          onClick={() => {
            setStep((s) => (s === 'login' ? 'register' : 'login'));
            setError(null);
            setInfo(null);
          }}
        >
          {step === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  );
}
