import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/1dollar-auth'
import { FinanceProvider } from './lib/FinanceContext'
import { Layout } from './components/Layout'
import { LoadingScreen } from './components/ui'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Transacoes } from './pages/Transacoes'
import { Contas } from './pages/Contas'
import { Orcamento } from './pages/Orcamento'
import { Cartoes } from './pages/Cartoes'
import { Investimentos } from './pages/Investimentos'
import { Assistente } from './pages/Assistente'
import { Admin } from './pages/Admin'

function RequireAuth() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  return (
    <FinanceProvider>
      <Layout />
    </FinanceProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Dashboard />} />
          <Route path="transacoes" element={<Transacoes />} />
          <Route path="contas" element={<Contas />} />
          <Route path="orcamento" element={<Orcamento />} />
          <Route path="cartoes" element={<Cartoes />} />
          <Route path="investimentos" element={<Investimentos />} />
          <Route path="assistente" element={<Assistente />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
