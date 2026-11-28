import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bot, Maximize2, X } from 'lucide-react'
import JarvisChat from './JarvisChat'
import { cx } from './ui'

export default function JarvisLauncher() {
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)

  const alternar = useCallback(() => setAberto((v) => !v), [])
  const fechar = useCallback(() => setAberto(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        alternar()
      }
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alternar, fechar])

  if (pathname.startsWith('/assistente')) return null

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-label="Falar com o Jarvis"
        aria-expanded={aberto}
        className="fixed right-4 bottom-20 md:bottom-6 z-40 rounded-full bg-primary text-primary-ink shadow-lg h-14 w-14 justify-center sm:w-auto sm:px-5 flex items-center gap-2 font-medium transition duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <Bot size={22} />
        <span className="hidden sm:inline">Jarvis</span>
      </button>

      <div
        className={cx(
          'fixed inset-0 z-50 bg-black/30 transition-opacity duration-200',
          aberto ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={fechar}
        aria-hidden={!aberto}
      />

      <aside
        className={cx(
          'fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-bg border-l border-line shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          aberto ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-label="Painel do Jarvis"
        aria-hidden={!aberto}
      >
        <div className="flex items-center justify-between gap-2 px-3 h-14 border-b border-line shrink-0">
          <Link
            to="/assistente"
            onClick={fechar}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-lg text-sm text-ink border border-line hover:bg-surface-2 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Maximize2 size={16} />
            <span>Abrir em tela cheia</span>
          </Link>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar o Jarvis"
            className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-soft hover:text-ink hover:bg-surface-2 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <JarvisChat compacto />
        </div>
      </aside>
    </>
  )
}
