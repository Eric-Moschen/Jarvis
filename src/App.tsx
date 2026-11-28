import { type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/1dollar-auth'
import { FinanceProvider, useFinance } from './lib/FinanceContext'
import { JarvisProvider } from './lib/JarvisContext'
import { Layout } from './components/Layout'
import { LoadingScreen } from './components/ui'
import Onboarding from './pages/Onboarding'
import { Dashboard as Painel } from './pages/Dashboard'
import { Transacoes } from './pages/Transacoes'
import { Contas } from './pages/Contas'
import { Orcamento } from './pages/Orcamento'
import { Cartoes } from './pages/Cartoes'
import { Investimentos } from './pages/Investimentos'
import Relatorios from './pages/Relatorios'
import Alertas from './pages/Alertas'
import { Assistente } from './pages/Assistente'
import { Admin } from './pages/Admin'
import { Login } from './pages/Login'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PerfilGate({ children }: { children: ReactNode }) {
  const { loading, error, perfil } = useFinance()
  if (loading) return <LoadingScreen />
  if (!error && !perfil) return <Onboarding />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <FinanceProvider>
                <PerfilGate>
                  <JarvisProvider>
                    <Layout />
                  </JarvisProvider>
                </PerfilGate>
              </FinanceProvider>
            </RequireAuth>
          }
        >
          <Route path="/" element={<Painel />} />
          <Route path="/transacoes" element={<Transacoes />} />
          <Route path="/contas" element={<Contas />} />
          <Route path="/orcamento" element={<Orcamento />} />
          <Route path="/cartoes" element={<Cartoes />} />
          <Route path="/investimentos" element={<Investimentos />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
