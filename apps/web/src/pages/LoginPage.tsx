import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LOGO_BARS, LOGO_VIEWBOX, LOGO_WEB_BAR_COLORS } from '@reprise/shared';
import { Auth } from '../api/auth';
import { Logo } from '../components/Logo';
import './LoginPage.css';

/** Entrar · criar conta · digitar o código que valida a conta recém-criada. */
type Step = 'login' | 'register' | 'confirm';

/**
 * A porta de entrada — e, para quem chega pelo endereço, a única página que existe.
 *
 * <b>Antes era só o formulário.</b> Um painel de 24rem centralizado no vazio, com a logo em cima
 * e a frase "Uma exibição é um evento, não um booleano" logo abaixo. Essa frase é o princípio do
 * projeto, e é boa — mas é uma afirmação sobre modelagem de dados, dita a alguém que ainda não
 * sabe o que o produto faz. A página pedia senha antes de dizer para quê.
 *
 * Agora são duas colunas: à esquerda o que o Reprise é, em linguagem de quem assiste; à direita a
 * mesma caixa de sempre. A ordem no HTML é formulário PRIMEIRO — em tela estreita as colunas
 * empilham nessa ordem, e quem já tem conta (a quase totalidade das visitas) não deve rolar por
 * um discurso que já leu. Em tela larga o `grid` inverte a posição visual sem mexer no DOM, então
 * a ordem de tabulação continua sendo "entrar" antes de "ler sobre".
 */
export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <div className="landing">
      <div className="landing__inner">
        <SignInCard onSignedIn={onSignedIn} />
        <Pitch />
      </div>
    </div>
  );
}

/**
 * O que o produto faz, com os marcadores desenhados a partir da própria logo.
 *
 * As quatro barras crescentes são a marca do Reprise; reaproveitá-las como marcador da lista faz
 * a página se explicar com o vocabulário que ela mesma tem, em vez de importar ícones de fora.
 */
function Pitch() {
  return (
    <section className="pitch">
      <p className="pitch__wordmark">
        <Logo size={30} title="Reprise" />
        Reprise
      </p>

      <h1 className="pitch__headline">Onde você parou, e quantas vezes já voltou.</h1>

      <p className="pitch__lede">
        Um lugar para o seu histórico de séries que não trata “assisti” como uma caixinha marcada.
        Toda exibição fica registrada com data — inclusive a segunda, a terceira e a décima sétima
        vez que você viu o mesmo episódio.
      </p>

      <ul className="pitch__points" role="list">
        <Point titulo="Reassistir conta">
          Rever não é desmarcar e marcar de novo. Cada passada vira uma sessão, com quando começou,
          quanto durou e quantos episódios teve.
        </Point>
        <Point titulo="Os dados são seus">
          Um botão baixa tudo em JSON: perfil, séries e cada exibição com data e origem. Foi
          exatamente o que faltou quando o TV Time fechou.
        </Point>
        <Point titulo="Sem anúncios, sem métricas">
          Nada aqui mede o que você faz. As capas vêm do TMDB; o resto não sai desta casa.
        </Point>
      </ul>

      <p className="pitch__credo">Uma exibição é um evento, não um booleano.</p>
    </section>
  );
}

/** Um item da lista, com as barras da logo como marcador. */
function Point({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="point">
      <PointMark />
      <div>
        <p className="point__title">{titulo}</p>
        <p className="point__text">{children}</p>
      </div>
    </li>
  );
}

/**
 * As barras da logo, em miniatura. `aria-hidden` porque é ornamento: a informação está no título
 * e no texto ao lado, e anunciar um gráfico antes de cada item só atrapalharia a leitura.
 */
function PointMark() {
  return (
    <svg className="point__mark" viewBox={LOGO_VIEWBOX} aria-hidden="true" focusable="false">
      {LOGO_BARS.map((bar, i) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          fill={LOGO_WEB_BAR_COLORS[i]}
          rx="1"
        />
      ))}
    </svg>
  );
}

/**
 * Autenticação. Espelha o app: mesmos passos, mesmos rótulos, mesmas mensagens.
 *
 * Um `<form>` de verdade, com `type="submit"`: é o que faz Enter funcionar, o que os
 * gerenciadores de senha reconhecem e o que o leitor de tela anuncia como formulário. Um `<div>`
 * com botão que escuta clique parece igual e não é nenhuma dessas coisas.
 */
function SignInCard({ onSignedIn }: { onSignedIn: () => void }) {
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
    <section className="signin" aria-labelledby="signin-h">
      {/*
        O passo tem título. Antes, o único sinal de que o formulário havia trocado de "entrar" para
        "criar conta" era o texto do botão lá embaixo — e os dois campos que apareciam no meio.
      */}
      <h2 className="signin__title" id="signin-h">
        {rotulo}
      </h2>

      <form className="signin__form" onSubmit={submit}>
        {step === 'confirm' ? (
          <>
            {info ? <p className="signin__info">{info}</p> : null}

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
              className="btn btn--quiet signin__switch"
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
          <p className="signin__error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="btn btn--primary signin__submit" type="submit" disabled={busy}>
          {busy ? 'Um momento…' : rotulo}
        </button>
      </form>

      <button
        className="btn btn--quiet signin__switch"
        type="button"
        onClick={() => {
          setStep((s) => (s === 'login' ? 'register' : 'login'));
          setError(null);
          setInfo(null);
        }}
      >
        {step === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
      </button>
    </section>
  );
}
