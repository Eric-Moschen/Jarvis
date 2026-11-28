import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Printer, TrendingDown, TrendingUp, FileBarChart } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinance } from '../lib/FinanceContext'
import { relatorioMensal, relatorioCSV, type Relatorio } from '../lib/insights'
import { addMonthsKey, brl, brlCompact, currentMonthKey, fmtDate, monthLabel, todayISO } from '../lib/finance'
import { Card, PageHeader, Button, EmptyState, cx } from '../components/ui'

function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return (atual - anterior) / anterior
}

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return null
  const positivo = valor >= 0
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs tabular', positivo ? 'text-income' : 'text-expense')}>
      {positivo ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {positivo ? '+' : ''}
      {(valor * 100).toFixed(1).replace('.', ',')}% vs mês anterior
    </span>
  )
}

function CardResumo({
  label,
  valor,
  tone,
  variacaoValor,
  hint,
}: {
  label: string
  valor: string
  tone?: 'income' | 'expense' | 'default'
  variacaoValor?: number | null
  hint?: string
}) {
  const tones = {
    income: 'text-income',
    expense: 'text-expense',
    default: 'text-ink',
  }
  return (
    <Card className="p-4">
      <div className="text-xs text-soft">{label}</div>
      <div className={cx('font-display text-xl md:text-2xl tabular mt-1', tones[tone ?? 'default'])}>{valor}</div>
      {hint ? <div className="text-xs text-soft mt-1">{hint}</div> : null}
      {variacaoValor !== undefined ? <div className="mt-1.5"><Variacao valor={variacaoValor} /></div> : null}
    </Card>
  )
}

export default function Relatorios() {
  const { view } = useFinance()
  const [params, setParams] = useSearchParams()
  const mesAtual = currentMonthKey()
  const mesParam = params.get('mes')
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesAtual

  const rel: Relatorio = useMemo(() => relatorioMensal(view, mes), [view, mes])

  const serie = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const key = addMonthsKey(mes, i - 5)
      const r = relatorioMensal(view, key)
      return { mes: monthLabel(key, true), receitas: r.receitas, despesas: r.despesas }
    })
  }, [view, mes])

  const semDados = rel.qtdLancamentos === 0 && rel.contasPagas.qtd === 0 && rel.contasPendentes.qtd === 0 && rel.contasAReceber.qtd === 0

  const irPara = (novo: string) => {
    const next = new URLSearchParams(params)
    next.set('mes', novo)
    setParams(next, { replace: true })
  }

  const baixarCSV = () => {
    const csv = relatorioCSV(rel)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jarvis-relatorio-${mes}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const totalCategorias = rel.porCategoria.reduce((acc, c) => acc + c.valor, 0)

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <div className="hidden print:block mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Relatório financeiro, {monthLabel(mes)}</h1>
        <p className="text-sm text-soft mt-1">Emitido em {fmtDate(todayISO())}</p>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          subtitle="Resumo do mês, comparação com o mês anterior e onde o dinheiro foi."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={baixarCSV}>
                <Download size={16} />
                Baixar CSV
              </Button>
              <Button variant="ghost" onClick={() => window.print()}>
                <Printer size={16} />
                Imprimir ou salvar PDF
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={() => irPara(addMonthsKey(mes, -1))}
            className="h-11 w-11 inline-flex items-center justify-center rounded-lg border border-line text-ink hover:bg-surface-2 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="font-display text-lg md:text-xl font-semibold text-ink capitalize">{monthLabel(mes)}</div>
          <button
            type="button"
            onClick={() => irPara(addMonthsKey(mes, 1))}
            disabled={mes >= mesAtual}
            className="h-11 w-11 inline-flex items-center justify-center rounded-lg border border-line text-ink hover:bg-surface-2 transition duration-200 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {semDados ? (
        <EmptyState
          icon={<FileBarChart size={28} />}
          title={`Nenhum movimento em ${monthLabel(mes)}`}
          text="Cadastre lançamentos ou peça ao Jarvis."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <CardResumo
              label="Receitas"
              valor={brl(rel.receitas)}
              tone="income"
              variacaoValor={variacao(rel.receitas, rel.anterior.receitas)}
            />
            <CardResumo
              label="Despesas"
              valor={brl(rel.despesas)}
              tone="expense"
              variacaoValor={variacao(rel.despesas, rel.anterior.despesas)}
            />
            <CardResumo
              label="Saldo"
              valor={brl(rel.saldo)}
              tone={rel.saldo >= 0 ? 'income' : 'expense'}
              variacaoValor={variacao(rel.saldo, rel.anterior.saldo)}
            />
            <CardResumo
              label="Taxa de poupança"
              valor={rel.taxaPoupanca === null ? 'Sem receitas' : `${(rel.taxaPoupanca * 100).toFixed(1).replace('.', ',')}%`}
              tone={rel.taxaPoupanca !== null && rel.taxaPoupanca >= 0 ? 'income' : 'default'}
            />
          </div>

          <Card>
            <h2 className="font-display text-base font-semibold text-ink mb-4">Últimos 6 meses</h2>
            <div className="h-64 md:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--color-soft)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => brlCompact(v)}
                    tick={{ fill: 'var(--color-soft)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v) => brl(Number(v))}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-line)',
                      borderRadius: 12,
                      color: 'var(--color-ink)',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--color-soft)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-soft)' }} />
                  <Bar dataKey="receitas" name="Receitas" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h2 className="font-display text-base font-semibold text-ink mb-4">Despesas por categoria</h2>
              {rel.porCategoria.length === 0 ? (
                <p className="text-sm text-soft">Nenhuma despesa registrada neste mês.</p>
              ) : (
                <ul className="space-y-3">
                  {rel.porCategoria.map((c) => {
                    const pct = totalCategorias > 0 ? c.valor / totalCategorias : 0
                    const v = c.anterior > 0 ? (c.valor - c.anterior) / c.anterior : null
                    return (
                      <li key={c.categoria}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm text-ink truncate">{c.categoria}</span>
                          <span className="text-sm tabular text-ink shrink-0">{brl(c.valor)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(2, pct * 100)}%` }} />
                          </div>
                          <span className="text-xs text-soft tabular w-10 text-right">{(pct * 100).toFixed(0)}%</span>
                        </div>
                        {v !== null ? (
                          <div className={cx('text-xs tabular mt-0.5', v >= 0 ? 'text-expense' : 'text-income')}>
                            {v >= 0 ? '+' : ''}
                            {(v * 100).toFixed(0)}% vs mês anterior
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="font-display text-base font-semibold text-ink mb-4">Maiores despesas</h2>
              {rel.maioresDespesas.length === 0 ? (
                <p className="text-sm text-soft">Nenhuma despesa registrada neste mês.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {rel.maioresDespesas.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="text-sm text-ink truncate">{t.descricao}</div>
                        <div className="text-xs text-soft">
                          {fmtDate(t.data)} · {t.categoria}
                        </div>
                      </div>
                      <span className="text-sm tabular text-expense shrink-0">{brl(t.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="font-display text-base font-semibold text-ink mb-4">Contas do mês</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-soft">Pagas</div>
                <div className="font-display text-lg tabular text-income mt-1">{brl(rel.contasPagas.valor)}</div>
                <div className="text-xs text-soft mt-0.5">{rel.contasPagas.qtd} {rel.contasPagas.qtd === 1 ? 'conta' : 'contas'}</div>
              </div>
              <div>
                <div className="text-xs text-soft">Pendentes</div>
                <div className="font-display text-lg tabular text-warn mt-1">{brl(rel.contasPendentes.valor)}</div>
                <div className="text-xs text-soft mt-0.5">{rel.contasPendentes.qtd} {rel.contasPendentes.qtd === 1 ? 'conta' : 'contas'}</div>
              </div>
              <div>
                <div className="text-xs text-soft">A receber</div>
                <div className="font-display text-lg tabular text-primary mt-1">{brl(rel.contasAReceber.valor)}</div>
                <div className="text-xs text-soft mt-0.5">{rel.contasAReceber.qtd} {rel.contasAReceber.qtd === 1 ? 'conta' : 'contas'}</div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
