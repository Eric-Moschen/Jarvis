import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { ai, type AiStatus } from '../lib/1dollar-ai'
import { useFinance } from '../lib/FinanceContext'
import {
  brl,
  currentMonthKey,
  addMonthsKey,
  fmtDate,
  lastMonths,
  monthLabel,
  monthTotals,
  openInvoice,
  percent,
  spendByCategory,
  todayISO,
  usedLimit,
} from '../lib/finance'
import type { Cartao, Conta, EscopoFiltro, Investimento, Meta, Orcamento, Transacao } from '../lib/types'
import { Button, Card, ErrorNote, PageHeader, cx } from '../components/ui'

type Role = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: Role
  content: string
}

interface ChatError {
  id: string
  message: string
}

const SUGESTOES = [
  'Quanto gastei este mês?',
  'Onde posso economizar?',
  'Quais contas vencem esta semana?',
  'Como estão meus orçamentos?',
  'Como estão meus investimentos?',
]

const ESCOPO_LABEL: Record<EscopoFiltro, string> = {
  todos: 'Pessoal e empresa',
  pessoal: 'Pessoal',
  empresa: 'Empresa',
}

const INSTRUCOES = [
  'Você é o Jarvis, assistente financeiro pessoal e empresarial do usuário.',
  'Responda em português do Brasil, curto e direto, só com base nos dados fornecidos.',
  'Não invente valores. Se faltar dado, diga que não há informação suficiente.',
  'Valores sempre em R$.',
  'Não dê recomendação de compra de ativos específicos.',
  'Nunca use travessão.',
].join(' ')

function resumoContas(contas: Conta[]): string {
  const pendentes = contas.filter((c) => c.status === 'pendente').slice(0, 30)
  if (pendentes.length === 0) return 'Contas pendentes: nenhuma.'
  const hoje = todayISO()
  const linhas = pendentes.map((c) => {
    const atrasada = c.vencimento < hoje
    const tipo = c.tipo === 'pagar' ? 'a pagar' : 'a receber'
    return `- ${c.descricao} (${tipo}, ${c.categoria}, vence ${fmtDate(c.vencimento)}, ${brl(c.valor)}${atrasada ? ', atrasada' : ''})`
  })
  return `Contas pendentes (até 30):\n${linhas.join('\n')}`
}

function resumoOrcamentos(orcamentos: Orcamento[], transacoes: Transacao[], mes: string): string {
  if (orcamentos.length === 0) return 'Orçamentos: nenhum cadastrado.'
  const linhas = orcamentos.map((o) => {
    const gasto = transacoes
      .filter((t) => t.tipo === 'despesa' && t.categoria === o.categoria && t.escopo === o.escopo && t.data.slice(0, 7) === mes)
      .reduce((acc, t) => acc + t.valor, 0)
    const pct = Math.round(percent(gasto, o.limite))
    return `- ${o.categoria} (${o.escopo}): ${brl(gasto)} de ${brl(o.limite)} (${pct}%)`
  })
  return `Orçamentos do mês atual:\n${linhas.join('\n')}`
}

function resumoMetas(metas: Meta[]): string {
  if (metas.length === 0) return 'Metas: nenhuma cadastrada.'
  const linhas = metas.map((m) => {
    const pct = Math.round(percent(m.valor_atual, m.valor_alvo))
    const prazo = m.prazo ? `, prazo ${fmtDate(m.prazo)}` : ''
    return `- ${m.nome} (${m.escopo}): ${brl(m.valor_atual)} de ${brl(m.valor_alvo)} (${pct}%${prazo})`
  })
  return `Metas:\n${linhas.join('\n')}`
}

function resumoCartoes(cartoes: Cartao[], transacoes: Transacao[]): string {
  if (cartoes.length === 0) return 'Cartões: nenhum cadastrado.'
  const linhas = cartoes.map((c) => {
    const fatura = openInvoice(c, transacoes)
    const usado = usedLimit(c, transacoes)
    return `- ${c.nome} (${c.escopo}): fatura aberta ${brl(fatura.total)}, limite ${brl(c.limite)}, usado ${brl(usado)}`
  })
  return `Cartões:\n${linhas.join('\n')}`
}

function resumoInvestimentos(investimentos: Investimento[]): string {
  if (investimentos.length === 0) return 'Investimentos: nenhum cadastrado.'
  const linhas = investimentos.map((i) => {
    const resultado = i.valor_atual - i.valor_investido
    return `- ${i.nome} (${i.tipo}, ${i.escopo}): aplicado ${brl(i.valor_investido)}, atual ${brl(i.valor_atual)}, resultado ${brl(resultado)}`
  })
  return `Investimentos:\n${linhas.join('\n')}`
}

function resumoTransacoes(transacoes: Transacao[]): string {
  const recentes = transacoes.slice(0, 40)
  if (recentes.length === 0) return 'Transações recentes: nenhuma.'
  const linhas = recentes.map((t) => {
    const sinal = t.tipo === 'receita' ? '+' : '-'
    return `- ${fmtDate(t.data)} ${t.descricao} (${t.categoria}, ${t.escopo}): ${sinal}${brl(t.valor)}`
  })
  return `40 transações mais recentes:\n${linhas.join('\n')}`
}

function buildContext(input: {
  escopo: EscopoFiltro
  transacoes: Transacao[]
  contas: Conta[]
  orcamentos: Orcamento[]
  metas: Meta[]
  cartoes: Cartao[]
  investimentos: Investimento[]
}): string {
  const { escopo, transacoes, contas, orcamentos, metas, cartoes, investimentos } = input
  const mesAtual = currentMonthKey()
  const mesAnterior = addMonthsKey(mesAtual, -1)

  const meses = lastMonths(6)
    .map((key) => {
      const t = monthTotals(transacoes, key)
      return `- ${monthLabel(key)}: receitas ${brl(t.receitas)}, despesas ${brl(t.despesas)}, saldo ${brl(t.saldo)}`
    })
    .join('\n')

  const catAtual = spendByCategory(transacoes, mesAtual)
    .map((c) => `- ${c.categoria}: ${brl(c.valor)}`)
    .join('\n')
  const catAnterior = spendByCategory(transacoes, mesAnterior)
    .map((c) => `- ${c.categoria}: ${brl(c.valor)}`)
    .join('\n')

  return [
    `Data de hoje: ${fmtDate(todayISO())}.`,
    `Escopo dos dados: ${ESCOPO_LABEL[escopo]}.`,
    `Totais dos últimos 6 meses:\n${meses}`,
    `Gasto por categoria em ${monthLabel(mesAtual)}:\n${catAtual || 'sem despesas'}`,
    `Gasto por categoria em ${monthLabel(mesAnterior)}:\n${catAnterior || 'sem despesas'}`,
    resumoContas(contas),
    resumoOrcamentos(orcamentos, transacoes, mesAtual),
    resumoMetas(metas),
    resumoCartoes(cartoes, transacoes),
    resumoInvestimentos(investimentos),
    resumoTransacoes(transacoes),
  ].join('\n\n')
}

export function Assistente() {
  const { view, escopo } = useFinance()
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [errors, setErrors] = useState<ChatError[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const s = await ai.status()
      setStatus(s)
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Não consegui verificar o assistente.')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, errors, sending])

  const contexto = useMemo(
    () =>
      buildContext({
        escopo,
        transacoes: view.transacoes,
        contas: view.contas,
        orcamentos: view.orcamentos,
        metas: view.metas,
        cartoes: view.cartoes,
        investimentos: view.investimentos,
      }),
    [escopo, view],
  )

  const enviar = useCallback(
    async (texto: string) => {
      const limpo = texto.trim()
      if (!limpo || sending) return

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: limpo }
      const historico = [...messages, userMsg]
      setMessages(historico)
      setInput('')
      setSending(true)

      const ultimas = historico.slice(-10).map((m) => ({ role: m.role, content: m.content }))

      try {
        const res = await ai.text({
          messages: [
            { role: 'system', content: `${INSTRUCOES}\n\nDados financeiros do usuário:\n${contexto}` },
            ...ultimas,
          ],
        })
        const resposta = res.text.trim()
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: resposta || 'Não consegui montar uma resposta com os dados atuais.' },
        ])
      } catch (e) {
        setErrors((prev) => [
          ...prev,
          { id: crypto.randomUUID(), message: e instanceof Error ? e.message : 'Não consegui falar com o Jarvis agora.' },
        ])
      } finally {
        setSending(false)
        textareaRef.current?.focus()
      }
    },
    [contexto, messages, sending],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void enviar(input)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const vazio = messages.length === 0 && errors.length === 0

  return (
    <div>
      <PageHeader title="Assistente Jarvis" subtitle="Pergunte sobre seus gastos, contas e metas" />

      {statusLoading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-primary" size={24} />
        </Card>
      ) : statusError ? (
        <Card className="space-y-4">
          <ErrorNote message={statusError} />
          <Button variant="ghost" onClick={() => void loadStatus()}>
            Tentar de novo
          </Button>
        </Card>
      ) : status && !status.configured ? (
        <Card className="max-w-xl">
          <div className="flex items-start gap-3">
            <Sparkles size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">O assistente ainda não foi ativado</h2>
              <p className="mt-1 text-sm text-soft">
                Cole a chave da OpenAI em Configurar IA para liberar as respostas
              </p>
              <Link
                to="/admin"
                className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink transition duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Configurar IA
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col p-0 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:min-h-[60vh]"
          >
            {vazio ? (
              <div className="mx-auto max-w-xl py-6 text-center">
                <Sparkles size={22} strokeWidth={1.75} className="mx-auto text-primary" />
                <h2 className="mt-3 font-display text-xl font-semibold text-ink">Olá, eu sou o Jarvis</h2>
                <p className="mt-1 text-sm text-soft">
                  Pergunte sobre seus gastos, contas e metas. Respondo com base nos seus dados do escopo {ESCOPO_LABEL[escopo].toLowerCase()}.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void enviar(s)}
                      className="rounded-full border border-line px-3 py-2 text-xs text-soft transition duration-200 hover:border-primary/60 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-ink whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex justify-start gap-2">
                      <Sparkles size={16} strokeWidth={1.75} className="mt-2 shrink-0 text-primary" />
                      <div className="max-w-[85%] rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-ink whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </div>
                  ),
                )}

                {errors.map((err) => (
                  <div key={err.id} className="flex justify-start">
                    <div className="max-w-[85%]">
                      <ErrorNote message={err.message} />
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex items-center gap-2 text-sm text-soft">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    Jarvis está analisando...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-line px-4 py-3 sm:px-6">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Escreva sua pergunta"
                disabled={sending}
                className={cx(
                  'w-full resize-none rounded-lg bg-surface-2 border border-line px-3 py-2.5 text-sm text-ink placeholder:text-soft focus:outline-none focus:border-primary disabled:opacity-60',
                )}
                style={{ maxHeight: 160 }}
              />
              <Button
                type="button"
                onClick={() => void enviar(input)}
                disabled={sending || !input.trim()}
                aria-label="Enviar mensagem"
              >
                <Send size={16} strokeWidth={2} />
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            </div>
            <p className="mt-2 text-xs text-soft">Enter envia, Shift+Enter quebra a linha.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
