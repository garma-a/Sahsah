import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import { LangProvider } from './lib/i18n'
import Shell, { FullScreenFrame } from './components/Shell'
import PlayPage from './pages/PlayPage'
import HomePage from './pages/HomePage'
import { lazy, Suspense } from 'react'
import GamePage from './pages/GamePage'
import JoinPage from './pages/JoinPage'
import { LoginPage, VerifyPage } from './pages/AuthPages'
import { AccountPage, CheckoutPage, ContactPage, TokensPage } from './pages/UtilityPages'

const AdminPage = lazy(() => import('./pages/AdminPage'))

export default function App() {
  return (
    <LangProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/play" element={<PlayPage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/verify" element={<VerifyPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/tokens" element={<TokensPage />} />
              <Route path="/checkout/:orderId" element={<CheckoutPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Route>
            <Route element={<FullScreenFrame />}>
              <Route
                path="/admin"
                element={
                  <Suspense
                    fallback={
                      <div className="grid min-h-dvh place-items-center font-display text-2xl">
                        ثانية واحدة…
                      </div>
                    }
                  >
                    <AdminPage />
                  </Suspense>
                }
              />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route path="/game/:sessionId" element={<GamePage />} />
              <Route path="/game/:sessionId/question/:id" element={<GamePage />} />
              <Route path="/game/:sessionId/results" element={<GamePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </LangProvider>
  )
}
