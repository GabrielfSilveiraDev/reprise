import { NavLink, Route, Routes } from 'react-router-dom';
import { NextUpPage } from './pages/NextUpPage';
import { SeriesDetailPage } from './pages/SeriesDetailPage';
import { SeriesListPage } from './pages/SeriesListPage';
import './App.css';

export function App() {
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
            </ul>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="app-main">
        <Routes>
          <Route path="/" element={<NextUpPage />} />
          <Route path="/series" element={<SeriesListPage />} />
          <Route path="/series/:id" element={<SeriesDetailPage />} />
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
