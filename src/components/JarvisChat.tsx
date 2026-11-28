import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Bot, CheckCircle2, Mic, MicOff, SendHorizontal, Trash2, Volume2, VolumeX } from 'lucide-react'
import { useJarvis } from '../lib/JarvisContext'
import { useFinance } from '../lib/FinanceContext'
import { alertasVencimento, relatorioMensal } from '../lib/insights'
import { brl, fmtDate, monthLabel, todayISO } from '../lib/finance'
import { EXEMPLOS } from '../lib/jarvis'
import { Button, Card, cx } from './ui'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function JarvisChat({ compacto = false }: { compacto?: boolean }) {
  const { mensagens, pensando, enviar, limpar, desfazer, voz, setVoz, iaConfigurada } = useJarvis()
  const { view } = useFinance()
  const [texto, setTexto] = useState('')
  const [escutando, setEscutando] = useState(false)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)
  const [erroDesfazer, setErroDesfazer] = useState<Record<string, string>>({})
  const listaRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const suportaVoz = useMemo(() => getSpeechRecognition() !== null, [])

  useEffect(() => {
    const el = listaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensagens, pensando])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [texto])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const enviarTexto = (valor: string) => {
    const limpo = valor.trim()
    if (!limpo || pensando) return
    setTexto('')
    void enviar(limpo)
  }

  const alternarEscuta = () => {
    if (escutando) {
      recognitionRef.current?.stop()
      setEscutando(false)
      return
    }
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'pt-BR'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (event) => {
      let parcial = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) final += r[0].transcript
        else parcial += r[0].transcript
      }
      if (parcial) setTexto(parcial)
      if (final) {
        setEscutando(false)
        enviarTexto(final)
      }
    }
    rec.onerror = () => setEscutando(false)
    rec.onend = () => setEscutando(false)
    recognitionRef.current = rec
    setEscutando(true)
    rec.start()
  }

  const executarDesfazer = async (mensagemId: string, resultadoId: string) => {
    setDesfazendo(resultadoId)
    setErroDesfazer((s) => ({ ...s, [resultadoId]: '' }))
    try {
      await desfazer(mensagemId, resultadoId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não consegui desfazer agora.'
      setErroDesfazer((s) => ({ ...s, [resultadoId]: msg }))
    } finally {
      setDesfazendo(null)
    }
  }

  const pad = compacto ? 'p-3' : 'p-4 md:p-6'
  const listaMax = compacto ? '' : 'max-w-3xl mx-auto w-full'
  const soInicial = mensagens.length === 1

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      <div className={cx('flex items-center justify-between gap-3 border-b border-line', compacto ? 'px-3 py-2.5' : 'px-4 md:px-6 py-3')}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Bot size={20} className="text-primary shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-ink leading-tight">Jarvis</div>
            <div className="text-xs text-soft truncate">
              {iaConfigurada === false ? 'Modo comandos (IA desligada)' : 'Assistente financeiro'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setVoz(!voz)}
            title="Ler respostas em voz alta"
            aria-label="Ler respostas em voz alta"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-soft hover:text-ink hover:bg-surface-2 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {voz ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            type="button"
            onClick={() => limpar()}
            title="Limpar conversa"
            aria-label="Limpar conversa"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-soft hover:text-ink hover:bg-surface-2 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div ref={listaRef} className={cx('flex-1 overflow-y-auto min-h-0', pad)}>
        <div className={cx('flex flex-col gap-3', listaMax)}>
          {mensagens.map((m) => {
            const doUsuario = m.autor === 'voce'
            return (
              <div key={m.id} className={cx('flex flex-col', doUsuario ? 'items-end' : 'items-start')}>
                <div
                  className={cx(
                    'px-4 py-2.5 whitespace-pre-wrap break-words',
                    compacto ? 'text-sm' : 'text-sm md:text-[15px]',
                    doUsuario
                      ? 'bg-primary text-white rounded-2xl rounded-br-md max-w-[85%]'
                      : 'bg-surface border border-line rounded-2xl rounded-bl-md max-w-[92%]',
                    !doUsuario && m.erro ? 'text-expense' : !doUsuario ? 'text-ink' : '',
                  )}
                >
                  {m.texto}
                </div>

                {!doUsuario && m.resultados && m.resultados.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1.5 max-w-[92%]">
                    {m.resultados.map((r) => {
                      const erroItem = erroDesfazer[r.id]
                      return (
                        <div key={r.id} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm">
                            {r.ok ? (
                              <CheckCircle2 size={15} className="text-income shrink-0" />
                            ) : (
                              <AlertCircle size={15} className="text-expense shrink-0" />
                            )}
                            <span className={cx('text-ink', r.desfeito && 'line-through text-soft')}>
                              {r.resumo}
                              {r.desfeito ? ' (desfeito)' : ''}
                            </span>
                            {r.desfazer && !r.desfeito ? (
                              <button
                                type="button"
                                onClick={() => void executarDesfazer(m.id, r.id)}
                                disabled={desfazendo === r.id}
                                className="text-xs text-primary hover:underline disabled:opacity-50 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                              >
                                {desfazendo === r.id ? 'Desfazendo...' : 'Desfazer'}
                              </button>
                            ) : null}
                          </div>
                          {erroItem ? <div className="text-xs text-expense pl-6">{erroItem}</div> : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {!doUsuario && m.relatorio ? (
                  <MiniRelatorio mes={m.relatorio} />
                ) : null}

                {!doUsuario && m.alertas ? (
                  <MiniAlertas />
                ) : null}
              </div>
            )
          })}

          {pensando ? (
            <div className="flex items-start">
              <div className="bg-surface border border-line rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-2 text-sm text-soft">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-soft animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-soft animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-soft animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
                Pensando...
              </div>
            </div>
          ) : null}

          {soInicial ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {EXEMPLOS.slice(0, 5).map((exemplo) => (
                <button
                  key={exemplo}
                  type="button"
                  onClick={() => enviarTexto(exemplo)}
                  disabled={pensando}
                  className="rounded-full border border-line px-3 py-1.5 text-sm text-soft hover:text-ink hover:bg-surface-2 transition duration-200 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {exemplo}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          enviarTexto(texto)
        }}
        className={cx('border-t border-line', compacto ? 'p-3' : 'p-4 md:px-6')}
      >
        <div className={cx('flex items-end gap-2', listaMax)}>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviarTexto(texto)
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Fale com o Jarvis..."
            className="flex-1 resize-none rounded-lg bg-surface-2 border border-line px-3 py-2.5 text-sm text-ink placeholder:text-soft focus:outline-none focus:border-primary min-h-11 max-h-24"
          />
          {suportaVoz ? (
            <button
              type="button"
              onClick={alternarEscuta}
              title={escutando ? 'Parar de ouvir' : 'Falar'}
              aria-label={escutando ? 'Parar de ouvir' : 'Falar'}
              className={cx(
                'h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-lg border transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                escutando
                  ? 'bg-primary text-primary-ink border-primary animate-pulse'
                  : 'border-line text-soft hover:text-ink hover:bg-surface-2',
              )}
            >
              {escutando ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          ) : null}
          <Button type="submit" variant="primary" disabled={!texto.trim() || pensando} className="shrink-0 w-11 px-0" aria-label="Enviar">
            <SendHorizontal size={18} />
          </Button>
        </div>
      </form>
    </div>
  )
}

function MiniRelatorio({ mes }: { mes: string }) {
  const { view } = useFinance()
  const r = relatorioMensal(view, mes)
  const top = r.porCategoria.slice(0, 3)
  return (
    <Card className="mt-2 p-4 max-w-[92%] w-full">
      <div className="text-sm font-medium text-ink mb-3">Relatório de {monthLabel(mes)}</div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-soft">Receitas</div>
          <div className="tabular text-sm text-income mt-0.5">{brl(r.receitas)}</div>
        </div>
        <div>
          <div className="text-xs text-soft">Despesas</div>
          <div className="tabular text-sm text-expense mt-0.5">{brl(r.despesas)}</div>
        </div>
        <div>
          <div className="text-xs text-soft">Saldo</div>
          <div className={cx('tabular text-sm mt-0.5', r.saldo >= 0 ? 'text-income' : 'text-expense')}>{brl(r.saldo)}</div>
        </div>
      </div>
      {top.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-1.5">
          <div className="text-xs text-soft">Maiores despesas por categoria</div>
          {top.map((c) => (
            <div key={c.categoria} className="flex items-center justify-between text-sm">
              <span className="text-ink">{c.categoria}</span>
              <span className="tabular text-soft">{brl(c.valor)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <Link
        to={`/relatorios?mes=${mes}`}
        className="inline-block mt-3 text-sm text-primary hover:underline transition duration-200"
      >
        Abrir relatório completo
      </Link>
    </Card>
  )
}

function MiniAlertas() {
  const { view } = useFinance()
  const lista = alertasVencimento(view, todayISO(), 15).slice(0, 6)
  return (
    <Card className="mt-2 p-4 max-w-[92%] w-full">
      <div className="text-sm font-medium text-ink mb-2">Próximos vencimentos</div>
      {lista.length === 0 ? (
        <p className="text-sm text-soft">Nada vencendo nos próximos 15 dias.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-ink truncate">{a.titulo}</div>
                <div
                  className={cx(
                    'text-xs',
                    a.nivel === 'atrasada' ? 'text-expense' : a.nivel === 'hoje' ? 'text-warn' : 'text-soft',
                  )}
                >
                  {a.detalhe}
                </div>
              </div>
              <div className="tabular text-sm text-ink shrink-0">{brl(a.valor)}</div>
            </div>
          ))}
        </div>
      )}
      <Link to="/alertas" className="inline-block mt-3 text-sm text-primary hover:underline transition duration-200">
        Ver todos os alertas
      </Link>
    </Card>
  )
}
