import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/1dollar-auth'
import { useFinance } from '../lib/FinanceContext'
import {
  brl,
  currentMonthKey,
  daysUntil,
  fmtDate,
  lastMonths,
  monthLabel,
  monthTotals,
  spendByCategory,
} from '../lib/finance'
import type { Conta } from '../lib/types'
import { TransacaoModal } from '../components/TransacaoModal'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Stat,
} from '../components/ui'

const CHART_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#8b97ab']

const tooltipStyle = {
  background: '#111722',
  border: '1px solid #222c3d',
  borderRadius: 12,
  color: '#e8edf5',
  fontSize: 12,
}

function firstName(name: string | undefined | null): string {
  if (!name) return ''
  return name.trim().split(/\s+/)[0] ?? ''
}

function prazoTexto(conta: Conta): { texto: string; tone: 'expense' | 'warn' | 'soft' | 'income' } {
  if (conta.status === 'pago') {
    const verbo = conta.tipo === 'receber' ? 'Recebida em' : 'Paga em'
    return { texto: `${verbo} ${conta.pago_em ? fmtDate(conta.pago_em) : ''}`, tone: 'income' }
  }
  const d = daysUntil(conta.vencimento)
  if (d < 0) return { texto: `Venceu há ${Math.abs(d)} ${Math.abs(d) === 1 ? 'dia' : 'dias'}`, tone: 'expense' }
  if (d === 0) return { texto: 'Vence hoje', tone: 'warn' }
  return { texto: `Em ${d} ${d === 1 ? 'dia' : 'dias'}`, tone: 'soft' }
}

export function Dashboard() {
  const { user } = useAuth()
  const { view } = useFinance()
  const [modalOpen, setModalOpen] = useState(false)

  const mesAtual = currentMonthKey()
  const mesAnterior = lastMonths(2)[0]

  const vazio =
    view.transacoes.length === 0 &&
    view.contas.length === 0 &&
    view.cartoes.length === 0 &&
    view.investimentos.length === 0

  const totaisAtual = useMemo(() => monthTotals(view.transacoes, mesAtual), [view.transacoes, mesAtual])
  const totaisAnterior = useMemo(() => monthTotals(view.transacoes, mesAnterior), [view.transacoes, mesAnterior])

  const patrimonio = useMemo(() => {
    const atual = view.investimentos.reduce((a, i) => a + i.valor_atual, 0)
    const investido = view.investimentos.reduce((a, i) => a + i.valor_investido, 0)
    const rent = investido > 0 ? ((atual - investido) / investido) * 100 : 0
    return { atual, investido, rent }
  }, [view.investimentos])

  const serie = useMemo(() => {
    return lastMonths(6).map((k) => {
      const t = monthTotals(view.transacoes, k)
      return { mes: monthLabel(k, true), receitas: t.receitas, despesas: t.despesas }
    })
  }, [view.transacoes])

  const categorias = useMemo(() => spendByCategory(view.transacoes, mesAtual).slice(0, 5), [view.transacoes, mesAtual])

  const proximos = useMemo(() => {
    return view.contas
      .filter((c) => c.status === 'pendente')
      .sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0))
      .slice(0, 5)
  }, [view.contas])

  const orcamentos = useMemo(() => {
    const gastos = new Map(spendByCategory(view.transacoes, mesAtual).map((s) => [s.categoria, s.valor]))
    return view.orcamentos
      .map((o) => {
        const gasto = gastos.get(o.categoria) ?? 0
        const pct = o.limite > 0 ? (gasto / o.limite) * 100 : 0
        return { ...o, gasto, pct }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4)
  }, [view.orcamentos, view.transacoes, mesAtual])

  const ultimas = useMemo(() => view.transacoes.slice(0, 6), [view.transacoes])

  const frases = useMemo(() => {
    const out: string[] = []

    if (totaisAnterior.despesas > 0) {
      const diff = ((totaisAtual.despesas - totaisAnterior.despesas) / totaisAnterior.despesas) * 100
      if (Math.abs(diff) >= 1) {
        const dir = diff > 0 ? 'acima' : 'abaixo'
        out.push(
          `Suas despesas estão ${Math.abs(diff).toFixed(0)}% ${dir} do mês passado (${brl(totaisAtual.despesas)} contra ${brl(totaisAnterior.despesas)}).`,
        )
      }
    }

    const urgentes = view.contas.filter((c) => {
      if (c.status !== 'pendente') return false
      const d = daysUntil(c.vencimento)
      return d <= 3
    })
    if (urgentes.length > 0) {
      const total = urgentes.reduce((a, c) => a + c.valor, 0)
      out.push(
        `${urgentes.length} ${urgentes.length === 1 ? 'conta vencida ou vencendo' : 'contas vencidas ou vencendo'} nos próximos dias, somando ${brl(total)}.`,
      )
    }

    const gastos = new Map(spendByCategory(view.transacoes, mesAtual).map((s) => [s.categoria, s.valor]))
    const estourados = view.orcamentos
      .map((o) => ({ o, gasto: gastos.get(o.categoria) ?? 0 }))
      .filter(({ o, gasto }) => o.limite > 0 && gasto / o.limite >= 0.8)
      .sort((a, b) => b.gasto / b.o.limite - a.gasto / a.o.limite)
    if (estourados.length > 0) {
      const top = estourados[0]
      const pct = Math.round((top.gasto / top.o.limite) * 100)
      out.push(`O orçamento de ${top.o.categoria} está em ${pct}% do limite neste mês.`)
    }

    if (out.length === 0) {
      out.push('Está tudo em dia por aqui. Nenhuma conta urgente e nenhum orçamento estourado.')
    }

    return out.slice(0, 3)
  }, [view.contas, view.orcamentos, view.transacoes, totaisAtual.despesas, totaisAnterior.despesas, mesAtual])

  const nome = firstName(user?.name)
  const titulo = nome ? `Olá, ${nome}` : 'Olá, bem-vindo'

  return (
    <div>
      <PageHeader title={titulo} subtitle={`Resumo de ${monthLabel(mesAtual)}`} />

      {vazio ? (
        <EmptyState
          icon={<Sparkles size={28} strokeWidth={1.5} />}
          title="Comece registrando seu primeiro lançamento"
          text="Com um lançamento registrado, o Jarvis já consegue montar o seu resumo do mês."
          action={<Button onClick={() => setModalOpen(true)}>Novo lançamento</Button>}
        />
      ) : (
        <div className="space-y-6">
          <Card className="flex items-start gap-3">
            <Sparkles size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-soft">Jarvis diz</p>
              <ul className="mt-1 space-y-1">
                {frases.map((f) => (
                  <li key={f} className="text-sm text-ink">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <Stat
                label="Saldo do mês"
                value={brl(totaisAtual.saldo)}
                tone={totaisAtual.saldo >= 0 ? 'income' : 'expense'}
              />
            </Card>
            <Card>
              <Stat label="Receitas" value={brl(totaisAtual.receitas)} tone="income" />
            </Card>
            <Card>
              <Stat label="Despesas" value={brl(totaisAtual.despesas)} tone="expense" />
            </Card>
            <Card>
              <Stat
                label="Patrimônio investido"
                value={brl(patrimonio.atual)}
                hint={
                  patrimonio.investido > 0
                    ? `${patrimonio.rent >= 0 ? '+' : ''}${patrimonio.rent.toFixed(1)}% sobre ${brl(patrimonio.investido)}`
                    : 'Nenhum investimento registrado'
                }
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h2 className="font-display text-base font-medium text-ink">Receitas x despesas</h2>
              <p className="text-xs text-soft mt-0.5">Últimos 6 meses</p>
              <div className="mt-4 h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4}>
                    <CartesianGrid stroke="#222c3d" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fill: '#8b97ab', fontSize: 11 }}
                      axisLine={{ stroke: '#222c3d' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#8b97ab', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => brl(v).replace(/\s/g, '')}
                      width={72}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: '#172030' }}
                      formatter={(value, name) => [brl(Number(value)), name === 'receitas' ? 'Receitas' : 'Despesas']}
                    />
                    <Bar dataKey="receitas" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="despesas" fill="#fb7185" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h2 className="font-display text-base font-medium text-ink">Despesas por categoria</h2>
              <p className="text-xs text-soft mt-0.5">{monthLabel(mesAtual)}</p>
              {categorias.length === 0 ? (
                <p className="text-sm text-soft mt-6">Nenhuma despesa registrada neste mês.</p>
              ) : (
                <>
                  <div className="mt-2 h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categorias}
                          dataKey="valor"
                          nameKey="categoria"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="#111722"
                          strokeWidth={2}
                        >
                          {categorias.map((c, i) => (
                            <Cell key={c.categoria} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => brl(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {categorias.map((c, i) => (
                      <li key={c.categoria} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                            aria-hidden="true"
                          />
                          <span className="truncate text-ink">{c.categoria}</span>
                        </span>
                        <span className="tabular shrink-0 text-soft">{brl(c.valor)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-medium text-ink">Próximos vencimentos</h2>
                <Link
                  to="/contas"
                  className="inline-flex items-center gap-1 text-xs text-primary transition duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                >
                  Ver todas
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
              </div>
              {proximos.length === 0 ? (
                <p className="text-sm text-soft mt-4">Nenhuma conta pendente.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {proximos.map((c) => {
                    const prazo = prazoTexto(c)
                    const toneClass =
                      prazo.tone === 'expense'
                        ? 'text-expense'
                        : prazo.tone === 'warn'
                          ? 'text-warn'
                          : prazo.tone === 'income'
                            ? 'text-income'
                            : 'text-soft'
                    return (
                      <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{c.descricao}</p>
                          <p className={`text-xs ${toneClass}`}>{prazo.texto}</p>
                        </div>
                        <span
                          className={`tabular shrink-0 text-sm ${c.tipo === 'receber' ? 'text-income' : 'text-ink'}`}
                        >
                          {brl(c.valor)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-medium text-ink">Orçamento do mês</h2>
                <Link
                  to="/orcamento"
                  className="inline-flex items-center gap-1 text-xs text-primary transition duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                >
                  Ver
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
              </div>
              {orcamentos.length === 0 ? (
                <p className="text-sm text-soft mt-4">
                  Nenhum orçamento definido.{' '}
                  <Link to="/orcamento" className="text-primary hover:brightness-110">
                    Definir orçamentos
                  </Link>
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {orcamentos.map((o) => {
                    const tone = o.pct > 100 ? 'expense' : o.pct > 80 ? 'warn' : 'primary'
                    return (
                      <li key={o.id}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-ink">{o.categoria}</span>
                          <span className="tabular shrink-0 text-soft">{Math.round(o.pct)}%</span>
                        </div>
                        <div className="mt-1.5">
                          <ProgressBar value={o.pct} tone={tone} />
                        </div>
                        <p className="tabular mt-1 text-xs text-soft">
                          {brl(o.gasto)} de {brl(o.limite)}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-medium text-ink">Últimas transações</h2>
                <Link
                  to="/transacoes"
                  className="inline-flex items-center gap-1 text-xs text-primary transition duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                >
                  Ver
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
              </div>
              {ultimas.length === 0 ? (
                <p className="text-sm text-soft mt-4">Nenhum lançamento ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {ultimas.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{t.descricao}</p>
                        <p className="text-xs text-soft">
                          {t.categoria} · {fmtDate(t.data)}
                        </p>
                      </div>
                      <span
                        className={`tabular shrink-0 text-sm ${t.tipo === 'receita' ? 'text-income' : 'text-expense'}`}
                      >
                        {t.tipo === 'receita' ? '+' : '-'} {brl(t.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <TransacaoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
