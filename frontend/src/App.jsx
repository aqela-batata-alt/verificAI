import { Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/layout/ErrorBoundary.jsx'
import Layout from './components/layout/Layout.jsx'
import { useAuth } from './hooks/useAuth.js'
import AccountPage from './pages/AccountPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import HomePage from './pages/HomePage.jsx'
import HowPage from './pages/HowPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import RecoveryPage from './pages/RecoveryPage.jsx'
import ResultPage from './pages/ResultPage.jsx'

/**
 * Rotas da aplicação (RF23: todas as telas ficam a um clique da navegação principal).
 *
 *   /                       início: formulário de análise (RF24)
 *   /resultado/:id          resultado (RF16–RF18, RF26); o endereço é o identificador da análise
 *   /historico              histórico local (RF20)
 *   /como-funciona          método e limites (RF30)
 *   /privacidade            tratamento de dados (RF30)
 *   /entrar, /criar-conta,
 *   /recuperar-acesso,
 *   /conta                  só existem quando as contas estão habilitadas (RF31, RF32, RF34)
 *
 * O roteador usa o histórico do navegador (endereços sem "#"). O servidor que entrega o site
 * precisa devolver index.html para qualquer caminho (veja deploy/nginx.conf).
 */
export default function App() {
  const { available } = useAuth()

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="resultado/:id" element={<ResultPage />} />
          <Route path="historico" element={<HistoryPage />} />
          <Route path="como-funciona" element={<HowPage />} />
          <Route path="privacidade" element={<PrivacyPage />} />
          {available ? (
            <>
              <Route path="entrar" element={<AuthPage mode="signin" />} />
              <Route path="criar-conta" element={<AuthPage mode="signup" />} />
              <Route path="recuperar-acesso" element={<RecoveryPage />} />
              <Route path="conta" element={<AccountPage />} />
            </>
          ) : null}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
