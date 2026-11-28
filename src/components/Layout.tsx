import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  ArrowLeftRight,
  Bell,
  Bot,
  CalendarClock,
  CreditCard,
  Eye,
  EyeOff,
  FileBarChart,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  Settings,
  Target,
  TrendingUp,
} from 'lucide-react'
import { signOut, useAuth } from '../lib/1dollar-auth'
import { useFinance } from '../lib/FinanceContext'
import { todayISO } from '../lib/finance'
import { alertasVencimento } from '../lib/insights'
import type { EscopoFiltro } from '../lib/types'
import ComprovanteModal from './ComprovanteModal'
import JarvisLauncher from './JarvisLauncher'
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
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { to: '/alertas', label: 'Alertas', icon: Bell },
  { to: '/assistente', label: 'Jarvis', icon: Bot },
]

const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/transacoes', label: 'Lançamentos', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas', icon: CalendarClock },
  { to: '/assistente', label: 'Jarvis', icon: Bot },
]

const MORE_NAV: NavItem[] = [
  { to: '/orcamento', label: 'Orçamento e metas', icon: Target },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { to: '/alertas', label: 'Alertas', icon: Bell },
  { to: '/admin', label: 'Configurar IA', icon: Settings },
]

const ESCOPO_OPTIONS: { value: EscopoFiltro; label: string }[] = [
  { value: 'todos', label: 'Tudo' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'empresa', label: 'Empresa' },
]

const PRIVACIDADE_KEY = 'jarvis_privacidade'
const AVISO_DIA_KEY = 'jarvis_aviso_dia'
const ULTIMA_ATIVIDADE_KEY = 'jarvis_ultima_atividade'
const INATIVIDADE_MS = 20 * 60 * 1000

function Brand() {
  return (
    <span className="font-display text-xl font-semibold text-ink">
      Jarvis<span className="text-primary">.</span>
    </span>
  )
}

function aplicarPrivacidade(ativa: boolean) {
  document.documentElement.classList.toggle('privacidade', ativa)
}

function lerPrivacidade(): boolean {
  try {
    return localStorage.getItem(PRIVACIDADE_KEY) === '1'
  } catch {
    return false
  }
}

function focoEmCampoDeTexto(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return (el as HTMLElement).isContentEditable === true
}

export function Layout() {
  const { user } = useAuth()
  const { escopo, setEscopo, escopoFixo, perfil, view, loading, error } = useFinance()
  const navigate = useNavigate()
  const location = useLocation()
  const [modalOpen, setModalOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [comprovanteOpen, setComprovanteOpen] = useState(false)
  const [arquivoInicial, setArquivoInicial] = useState<File | null>(null)
  const [privacidade, setPrivacidade] = useState<boolean>(() => lerPrivacidade())
  const comprovanteAbertoRef = useRef(false)
  comprovanteAbertoRef.current = comprovanteOpen

  const alertas = useMemo(() => alertasVencimento(view, todayISO(), 7), [view])
  const temAtrasada = alertas.some((a) => a.nivel === 'atrasada')

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    aplicarPrivacidade(privacidade)
    try {
      localStorage.setItem(PRIVACIDADE_KEY, privacidade ? '1' : '0')
    } catch {
      /* sem armazenamento */
    }
  }, [privacidade])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (comprovanteAbertoRef.current) return
      if (focoEmCampoDeTexto()) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind !== 'file') continue
        if (item.type !== 'image/*' && !item.type.startsWith('image/') && item.type !== 'application/pdf') continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        setArquivoInicial(file)
        setComprovanteOpen(true)
        return
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const registrarAtividade = () => {
      try {
        sessionStorage.setItem(ULTIMA_ATIVIDADE_KEY, String(Date.now()))
      } catch {
        /* sem armazenamento */
      }
    }

    const encerrar = () => {
      void signOut().finally(() => navigate('/login'))
    }

    const reiniciar = () => {
      registrarAtividade()
      if (timer) clearTimeout(timer)
      timer = setTimeout(encerrar, INATIVIDADE_MS)
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      let ultima = 0
      try {
        ultima = Number(sessionStorage.getItem(ULTIMA_ATIVIDADE_KEY) ?? 0)
      } catch {
        ultima = 0
      }
      if (ultima > 0 && Date.now() - ultima > INATIVIDADE_MS) {
        encerrar()
        return
      }
      reiniciar()
    }

    reiniciar()
    window.addEventListener('mousemove', reiniciar)
    window.addEventListener('keydown', reiniciar)
    window.addEventListener('click', reiniciar)
    window.addEventListener('touchstart', reiniciar)
    window.addEventListener('scroll', reiniciar, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('mousemove', reiniciar)
      window.removeEventListener('keydown', reiniciar)
      window.removeEventListener('click', reiniciar)
      window.removeEventListener('touchstart', reiniciar)
      window.removeEventListener('scroll', reiniciar)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [navigate])

  useEffect(() => {
    if (loading) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    const hoje = todayISO()
    let ultimoAviso: string | null = null
    try {
      ultimoAviso = localStorage.getItem(AVISO_DIA_KEY)
    } catch {
      ultimoAviso = null
    }
    if (ultimoAviso === hoje) return
    const pendentes = alertas.filter((a) => a.nivel === 'atrasada' || a.nivel === 'hoje').length
    if (pendentes === 0) return
    new Notification('Jarvis: contas para hoje', {
      body: `Você tem ${pendentes} conta(s) vencendo hoje ou atrasada(s).`,
    })
    try {
      localStorage.setItem(AVISO_DIA_KEY, hoje)
    } catch {
      /* sem armazenamento */
    }
  }, [loading, alertas])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function abrirComprovante() {
    setArquivoInicial(null)
    setComprovanteOpen(true)
  }

  const escopoTexto =
    escopoFixo === 'empresa'
      ? perfil?.nome_empresa
        ? perfil.nome_empresa
        : 'Conta empresa'
      : escopoFixo === 'pessoal'
        ? 'Conta pessoal'
        : null

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex print:hidden">
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
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/alertas' && alertas.length > 0 ? (
                    <span className={`text-xs ${temAtrasada ? 'text-danger' : 'text-warning'}`}>
                      {alertas.length}
                    </span>
                  ) : null}
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur lg:px-8 print:hidden">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="hidden lg:block">
            {escopoFixo ? (
              <span className="text-sm text-soft">{escopoTexto}</span>
            ) : (
              <Segmented options={ESCOPO_OPTIONS} value={escopo} onChange={(v) => setEscopo(v as EscopoFiltro)} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={abrirComprovante} aria-label="Comprovante">
              <Receipt size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">Comprovante</span>
            </Button>
            <NavLink
              to="/alertas"
              aria-label="Alertas"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Bell size={18} strokeWidth={1.75} />
              {alertas.length > 0 ? (
                <span
                  className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${temAtrasada ? 'bg-danger' : 'bg-warning'}`}
                />
              ) : null}
            </NavLink>
            <button
              type="button"
              onClick={() => setPrivacidade((v) => !v)}
              aria-label={privacidade ? 'Mostrar valores' : 'Ocultar valores'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {privacidade ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
            </button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Lançamento</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-4 pb-24 lg:p-8 lg:pb-8 print:p-0">
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

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden print:hidden">
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

      <ComprovanteModal
        open={comprovanteOpen}
        onClose={() => {
          setComprovanteOpen(false)
          setArquivoInicial(null)
        }}
        arquivoInicial={arquivoInicial}
      />

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
              <span className="flex-1">{item.label}</span>
              {item.to === '/alertas' && alertas.length > 0 ? (
                <span className={`text-xs ${temAtrasada ? 'text-danger' : 'text-warning'}`}>{alertas.length}</span>
              ) : null}
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

      <JarvisLauncher />
    </div>
  )
}
