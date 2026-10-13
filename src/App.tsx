import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import Shell, { FullScreenFrame } from './components/Shell'
import PlayPage from './pages/PlayPage'
import GamePage from './pages/GamePage'
import JoinPage from './pages/JoinPage'
import { LoginPage, VerifyPage } from './pages/AuthPages'
import { AccountPage, CheckoutPage, ContactPage, TokensPage } from './pages/UtilityPages'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/play" element={<PlayPage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/verify" element={<VerifyPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/tokens" element={<TokensPage />} />
            <Route path="/checkout/:orderId" element={<CheckoutPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Route>
          <Route element={<FullScreenFrame />}>
            <Route path="/join/:code" element={<JoinPage />} />
            <Route path="/game/:sessionId" element={<GamePage />} />
            <Route path="/game/:sessionId/question/:id" element={<GamePage />} />
            <Route path="/game/:sessionId/results" element={<GamePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/play" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
