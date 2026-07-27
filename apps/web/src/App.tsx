import { useCallback, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Auth } from './api/auth';
import { WebSession } from './api/session';
import { Logo } from './components/Logo';
import { LoginPage } from './pages/LoginPage';
import { NextUpPage } from './pages/NextUpPage';
import { ProfilePage } from './pages/ProfilePage';
import { SeriesDetailPage } from './pages/SeriesDetailPage';
import { SeriesListPage } from './pages/SeriesListPage';
import './App.css';

export function App() {
  /**
   * Sem sessão, nem a barra de navegação é montada: a API devolve 401 em tudo, e mostrar um
   * esqueleto de aplicativo que só sabe dar erro seria pior do que pedir a senha.
   */
  const [session, setSession] = useState(() => WebSession.read());
  const signedIn = useCallback(() => setSession(WebSession.read()), []);

  if (!session) return <LoginPage onSignedIn={signedIn} />;

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="app-bar">
        <div className="app-bar__inner">
          <NavLink to="/" className="brand">
            <Logo size={22} />
            Reprise
          </NavLink>
          <nav aria-label="Principal">
            <ul className="nav" role="list">
              <li>
                <NavLink to="/" end className="nav__link">
                  Próximos
                </NavLink>
              </li>
              <li>
                <NavLink to="/series" className="nav__link">
                  Séries
                </NavLink>
              </li>
              {/* "Estatísticas" saiu da barra: virou uma seção do perfil, como no app. */}
              <li>
                <NavLink to="/perfil" className="nav__link">
                  Perfil
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="app-bar__account">
            <span className="app-bar__who">{session.displayName}</span>
            <button
              className="btn btn--quiet"
              type="button"
              onClick={async () => {
                await Auth.logout();
                setSession(null);
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="app-main">
        <Routes>
          <Route path="/" element={<NextUpPage />} />
          <Route path="/series" element={<SeriesListPage />} />
          <Route path="/series/:id" element={<SeriesDetailPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          {/* O endereço antigo continua valendo: link salvo e aba aberta não podem virar 404
              porque a informação mudou de lugar. `replace` para não deixar um passo morto no
              histórico — voltar tem de sair da página, não redirecionar de novo. */}
          <Route path="/estatisticas" element={<Navigate to="/perfil" replace />} />
          <Route
            path="*"
            element={
              <div className="state">
                <p className="state__title">Página não encontrada</p>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
