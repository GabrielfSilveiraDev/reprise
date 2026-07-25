import { useCallback, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Auth } from './api/auth';
import { WebSession } from './api/session';
import { LoginPage } from './pages/LoginPage';
import { NextUpPage } from './pages/NextUpPage';
import { SeriesDetailPage } from './pages/SeriesDetailPage';
import { SeriesListPage } from './pages/SeriesListPage';
import { StatsPage } from './pages/StatsPage';
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
            Reprise
          </NavLink>
          <nav aria-label="Principal">
            <ul className="nav" role="list">
              <li>
                <NavLink to="/" end className="nav__link">
                  Próximo
                </NavLink>
              </li>
              <li>
                <NavLink to="/series" className="nav__link">
                  Séries
                </NavLink>
              </li>
              <li>
                <NavLink to="/estatisticas" className="nav__link">
                  Estatísticas
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
          <Route path="/estatisticas" element={<StatsPage />} />
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
