import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  ArrowLeftRight,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { signOut, useAuth } from '../lib/1dollar-auth'
import { useFinance } from '../lib/FinanceContext'
import type { EscopoFiltro } from '../lib/types'
import { TransacaoModal } from './TransacaoModal'
import { Button, ErrorNote, Modal, Segmented } from './ui'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/transacoes', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas', icon: CalendarClock },
  { to: '/orcamento', label: 'Orçamento e metas', icon: Target },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/assistente', label: 'Assistente', icon: Sparkles },
]

const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/transacoes', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas', icon: CalendarClock },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
]

const MORE_NAV: NavItem[] = [
  { to: '/orcamento', label: 'Orçamento e metas', icon: Target },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/assistente', label: 'Assistente', icon: Sparkles },
  { to: '/admin', label: 'Configurar IA', icon: Settings },
]

const ESCOPO_OPTIONS: { value: EscopoFiltro; label: string }[] = [
  { value: 'todos', label: 'Tudo' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'empresa', label: 'Empresa' },
]

function Brand() {
  return (
    <span className="font-display text-xl font-semibold text-ink">
      Jarvis<span className="text-primary">.</span>
    </span>
  )
}

export function Layout() {
  const { user } = useAuth()
  const { escopo, setEscopo, loading, error } = useFinance()
  const navigate = useNavigate()
  const location = useLocation()
  const [modalOpen, setModalOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-14 items-center border-b border-line px-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition duration-200 ${
                  isActive
                    ? 'bg-surface-2 text-ink'
                    : 'text-soft hover:bg-surface-2/60 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
                  )}
                  <item.icon size={18} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-line p-3">
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition duration-200 ${
                isActive ? 'bg-surface-2 text-ink' : 'text-soft hover:text-ink'
              }`
            }
          >
            <Settings size={18} strokeWidth={1.75} />
            <span>Configurar IA</span>
          </NavLink>
          <div className="px-3">
            <p className="truncate text-xs text-ink">{user?.name ?? 'Sua conta'}</p>
            <p className="truncate text-xs text-soft">{user?.email ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <Segmented options={ESCOPO_OPTIONS} value={escopo} onChange={(v) => setEscopo(v as EscopoFiltro)} />
            </div>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Lançamento</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-4 pb-24 lg:p-8 lg:pb-8">
          {error && (
            <div className="mb-4">
              <ErrorNote message={error} />
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition duration-200 ${
                isActive ? 'text-primary' : 'text-soft'
              }`
            }
          >
            <item.icon size={20} strokeWidth={1.75} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-soft transition duration-200 hover:text-ink focus:outline-none focus-visible:text-primary"
        >
          <MoreHorizontal size={20} strokeWidth={1.75} />
          <span>Mais</span>
        </button>
      </nav>

      <TransacaoModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais">
        <div className="space-y-1">
          {MORE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-ink transition duration-200 hover:bg-surface-2"
            >
              <item.icon size={18} strokeWidth={1.75} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <div className="mt-3 border-t border-line pt-3">
            <p className="px-3 text-xs text-ink">{user?.name ?? 'Sua conta'}</p>
            <p className="px-3 text-xs text-soft">{user?.email ?? ''}</p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 w-full rounded-lg px-3 py-3 text-left text-sm text-soft transition duration-200 hover:bg-surface-2 hover:text-ink"
            >
              Sair
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
