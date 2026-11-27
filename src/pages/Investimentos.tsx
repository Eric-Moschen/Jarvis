import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinance } from '../lib/FinanceContext'
import { brl, brlCompact, fmtDate, percent, todayISO } from '../lib/finance'
import { TIPOS_INVESTIMENTO, type Escopo, type Investimento } from '../lib/types'
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  ScopeBadge,
  Segmented,
  Stat,
  inputClass,
} from '../components/ui'

const CORES = ['#38bdf8', '#34d399', '#fb7185', '#fbbf24', '#a78bfa', '#22d3ee', '#f472b6', '#94a3b8']

const tooltipStyle = {
  backgroundColor: '#111722',
  border: '1px solid #222c3d',
  borderRadius: 12,
  color: '#e8edf5',
  fontSize: 12,
}

function resultadoPct(inv: Investimento): number {
  if (inv.valor_investido <= 0) return 0
  return ((inv.valor_atual - inv.valor_investido) / inv.valor_investido) * 100
}

function toneResultado(v: number): 'income' | 'expense' | 'default' {
  if (v > 0) return 'income'
  if (v < 0) return 'expense'
  return 'default'
}

function classeResultado(v: number): string {
  if (v > 0) return 'text-income'
  if (v < 0) return 'text-expense'
  return 'text-soft'
}

function sinalPct(v: number): string {
  const s = v.toFixed(1).replace('.', ',')
  return `${v > 0 ? '+' : ''}${s}%`
}

export function Investimentos() {
  const { view, escopo, removeInvestimento } = useFinance()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Investimento | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const lista = useMemo(
    () => [...view.investimentos].sort((a, b) => b.valor_atual - a.valor_atual),
    [view.investimentos],
  )

  const patrimonio = lista.reduce((acc, i) => acc + i.valor_atual, 0)
  const aplicado = lista.reduce((acc, i) => acc + i.valor_investido, 0)
  const resultado = patrimonio - aplicado
  const rentabilidade = aplicado > 0 ? (resultado / aplicado) * 100 : 0

  const porTipo = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of lista) {
      map.set(i.tipo, (map.get(i.tipo) ?? 0) + i.valor_atual)
    }
    return [...map.entries()]
      .map(([tipo, valor]) => ({ tipo, valor }))
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor)
  }, [lista])

  const porAtivo = useMemo(
    () =>
      lista.slice(0, 8).map((i) => ({
        nome: i.nome.length > 14 ? i.nome.slice(0, 13) + '…' : i.nome,
        aplicado: i.valor_investido,
        atual: i.valor_atual,
      })),
    [lista],
  )

  function abrirNovo() {
    setEditing(null)
    setModalOpen(true)
  }

  function abrirEdicao(inv: Investimento) {
    setEditing(inv)
    setModalOpen(true)
  }

  async function handleRemover(inv: Investimento) {
    const ok = window.confirm(`Excluir o investimento "${inv.nome}"?`)
    if (!ok) return
    setErro(null)
    try {
      await removeInvestimento(inv.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir o investimento.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Investimentos e patrimônio"
        subtitle="O que você já construiu"
        action={
          <Button onClick={abrirNovo}>
            <Plus size={16} strokeWidth={2} />
            Novo investimento
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Stat label="Patrimônio atual" value={brl(patrimonio)} />
          <Stat label="Total aplicado" value={brl(aplicado)} />
          <Stat
            label="Resultado"
            value={`${resultado > 0 ? '+' : ''}${brl(resultado)}`}
            tone={toneResultado(resultado)}
          />
          <Stat
            label="Rentabilidade"
            value={sinalPct(rentabilidade)}
            tone={toneResultado(rentabilidade)}
          />
        </div>
      </Card>

      {erro && (
        <div className="mb-4">
          <ErrorNote message={erro} />
        </div>
      )}

      {lista.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={28} strokeWidth={1.5} />}
          title="Nenhum investimento registrado"
          text="Cadastre o que você já aplicou para acompanhar a rentabilidade ao longo do tempo."
          action={
            <Button variant="ghost" onClick={abrirNovo}>
              <Plus size={16} strokeWidth={2} />
              Novo investimento
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="font-display text-base font-medium text-ink mb-4">Distribuição</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porTipo}
                      dataKey="valor"
                      nameKey="tipo"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      stroke="#111722"
                      strokeWidth={2}
                    >
                      {porTipo.map((d, i) => (
                        <Cell key={d.tipo} fill={CORES[i % CORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => brl(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2">
                {porTipo.map((d, i) => (
                  <li key={d.tipo} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CORES[i % CORES.length] }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-ink">{d.tipo}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-soft tabular text-xs">
                        {percent(d.valor, patrimonio).toFixed(0)}%
                      </span>
                      <span className="tabular text-ink">{brl(d.valor)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h2 className="font-display text-base font-medium text-ink mb-4">Aplicado x atual por ativo</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porAtivo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="nome"
                      tick={{ fill: '#8b97ab', fontSize: 11 }}
                      axisLine={{ stroke: '#222c3d' }}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fill: '#8b97ab', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => brlCompact(v)}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(56,189,248,0.06)' }}
                      formatter={(value) => brl(Number(value))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#8b97ab' }} />
                    <Bar dataKey="aplicado" name="Aplicado" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="atual" name="Atual" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0">
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-soft border-b border-line">
                    <th className="px-5 py-3 font-normal">Ativo</th>
                    <th className="px-3 py-3 font-normal">Data</th>
                    <th className="px-3 py-3 font-normal text-right">Aplicado</th>
                    <th className="px-3 py-3 font-normal text-right">Atual</th>
                    <th className="px-3 py-3 font-normal text-right">Resultado</th>
                    <th className="px-5 py-3 font-normal text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lista.map((inv) => {
                    const pct = resultadoPct(inv)
                    return (
                      <tr key={inv.id} className="hover:bg-surface-2/40 transition duration-200">
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">{inv.nome}</span>
                            <ScopeBadge escopo={inv.escopo} />
                          </div>
                          <div className="text-xs text-soft mt-0.5">{inv.tipo}</div>
                        </td>
                        <td className="px-3 py-3 text-soft tabular">{fmtDate(inv.data)}</td>
                        <td className="px-3 py-3 text-right tabular text-ink">{brl(inv.valor_investido)}</td>
                        <td className="px-3 py-3 text-right tabular text-ink">{brl(inv.valor_atual)}</td>
                        <td className={`px-3 py-3 text-right tabular ${classeResultado(pct)}`}>{sinalPct(pct)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => abrirEdicao(inv)}
                              className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                              aria-label="Editar investimento"
                            >
                              <Pencil size={16} strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRemover(inv)}
                              className="rounded-lg p-2 text-soft transition duration-200 hover:bg-expense/10 hover:text-expense focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                              aria-label="Excluir investimento"
                            >
                              <Trash2 size={16} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {lista.map((inv) => {
                const pct = resultadoPct(inv)
                return (
                  <li key={inv.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink truncate">{inv.nome}</span>
                          <ScopeBadge escopo={inv.escopo} />
                        </div>
                        <div className="text-xs text-soft mt-0.5">
                          {inv.tipo} · {fmtDate(inv.data)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => abrirEdicao(inv)}
                          className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          aria-label="Editar investimento"
                        >
                          <Pencil size={16} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemover(inv)}
                          className="rounded-lg p-2 text-soft transition duration-200 hover:bg-expense/10 hover:text-expense focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          aria-label="Excluir investimento"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-soft">Aplicado</div>
                        <div className="tabular text-ink mt-0.5">{brl(inv.valor_investido)}</div>
                      </div>
                      <div>
                        <div className="text-soft">Atual</div>
                        <div className="tabular text-ink mt-0.5">{brl(inv.valor_atual)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-soft">Resultado</div>
                        <div className={`tabular mt-0.5 ${classeResultado(pct)}`}>{sinalPct(pct)}</div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}

      <InvestimentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        escopoAtual={escopo}
      />
    </div>
  )
}

type InvestimentoModalProps = {
  open: boolean
  onClose: () => void
  initial: Investimento | null
  escopoAtual: 'todos' | Escopo
}

function InvestimentoModal({ open, onClose, initial, escopoAtual }: InvestimentoModalProps) {
  const { addInvestimento, updateInvestimento } = useFinance()

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState(TIPOS_INVESTIMENTO[0])
  const [investido, setInvestido] = useState('')
  const [atual, setAtual] = useState('')
  const [data, setData] = useState(todayISO())
  const [escopoSel, setEscopoSel] = useState<Escopo>('pessoal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    if (initial) {
      setNome(initial.nome)
      setTipo(initial.tipo)
      setInvestido(String(initial.valor_investido))
      setAtual(String(initial.valor_atual))
      setData(initial.data.slice(0, 10))
      setEscopoSel(initial.escopo)
    } else {
      setNome('')
      setTipo(TIPOS_INVESTIMENTO[0])
      setInvestido('')
      setAtual('')
      setData(todayISO())
      setEscopoSel(escopoAtual === 'todos' ? 'pessoal' : escopoAtual)
    }
  }, [open, initial, escopoAtual])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nome.trim()) {
      setError('Dê um nome ao investimento.')
      return
    }
    const investidoNum = Number(investido)
    if (!investido.trim() || !Number.isFinite(investidoNum) || investidoNum < 0) {
      setError('Informe o valor investido, maior ou igual a zero.')
      return
    }
    const atualNum = atual.trim() ? Number(atual) : investidoNum
    if (!Number.isFinite(atualNum) || atualNum < 0) {
      setError('O valor atual precisa ser maior ou igual a zero.')
      return
    }
    if (!data) {
      setError('Escolha a data da aplicação.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        tipo,
        valor_investido: Math.round(investidoNum * 100) / 100,
        valor_atual: Math.round(atualNum * 100) / 100,
        data,
        escopo: escopoSel,
      }
      if (initial) {
        await updateInvestimento(initial.id, payload)
      } else {
        await addInvestimento(payload)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o investimento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar investimento' : 'Novo investimento'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input
            className={inputClass}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Tesouro Selic 2029"
            autoFocus
          />
        </Field>

        <Field label="Tipo">
          <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_INVESTIMENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor investido">
            <input
              className={inputClass + ' tabular'}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={investido}
              onChange={(e) => setInvestido(e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <Field label="Valor atual" hint={initial ? undefined : 'Em branco usa o valor investido.'}>
            <input
              className={inputClass + ' tabular'}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              placeholder="0,00"
            />
          </Field>
        </div>

        <Field label="Data">
          <input className={inputClass} type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>

        <Field label="Escopo">
          <Segmented
            options={[
              { value: 'pessoal', label: 'Pessoal' },
              { value: 'empresa', label: 'Empresa' },
            ]}
            value={escopoSel}
            onChange={(v) => setEscopoSel(v as Escopo)}
          />
        </Field>

        <p className="text-xs text-soft">Atualize o valor atual quando quiser acompanhar a rentabilidade.</p>

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
