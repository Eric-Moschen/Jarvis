import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Target, Trash2, Wallet } from 'lucide-react'
import { useFinance } from '../lib/FinanceContext'
import {
  addMonthsKey,
  brl,
  currentMonthKey,
  daysUntil,
  fmtDate,
  monthLabel,
  percent,
  spendByCategory,
  todayISO,
} from '../lib/finance'
import { CATEGORIAS_DESPESA, type Escopo, type Meta, type Orcamento as OrcamentoTipo } from '../lib/types'
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  ProgressBar,
  ScopeBadge,
  Segmented,
  Stat,
  inputClass,
} from '../components/ui'

const ESCOPO_OPTIONS = [
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'empresa', label: 'Empresa' },
]

function toneFor(pct: number): 'primary' | 'warn' | 'expense' {
  if (pct > 100) return 'expense'
  if (pct > 80) return 'warn'
  return 'primary'
}

function monthsUntil(iso: string): number {
  const dias = daysUntil(iso)
  if (dias <= 0) return 0
  return Math.max(1, Math.ceil(dias / 30))
}

export function Orcamento() {
  const { view, all, addOrcamento, updateOrcamento, removeOrcamento, addMeta, updateMeta, removeMeta } = useFinance()
  const [mes, setMes] = useState(currentMonthKey())
  const [erro, setErro] = useState<string | null>(null)

  const [orcModalOpen, setOrcModalOpen] = useState(false)
  const [orcEditing, setOrcEditing] = useState<OrcamentoTipo | null>(null)
  const [orcCategoriaInicial, setOrcCategoriaInicial] = useState<string | null>(null)

  const [metaModalOpen, setMetaModalOpen] = useState(false)
  const [metaEditing, setMetaEditing] = useState<Meta | null>(null)

  const [valorModalMeta, setValorModalMeta] = useState<Meta | null>(null)

  const gastoPorEscopo = useMemo(() => {
    const pessoal = spendByCategory(all.transacoes.filter((t) => t.escopo === 'pessoal'), mes)
    const empresa = spendByCategory(all.transacoes.filter((t) => t.escopo === 'empresa'), mes)
    const map = new Map<string, number>()
    for (const g of pessoal) map.set(`pessoal:${g.categoria}`, g.valor)
    for (const g of empresa) map.set(`empresa:${g.categoria}`, g.valor)
    return map
  }, [all.transacoes, mes])

  const gastoDe = (o: OrcamentoTipo) => gastoPorEscopo.get(`${o.escopo}:${o.categoria}`) ?? 0

  const totalOrcado = view.orcamentos.reduce((acc, o) => acc + o.limite, 0)
  const totalGasto = view.orcamentos.reduce((acc, o) => acc + gastoDe(o), 0)
  const totalDisponivel = totalOrcado - totalGasto

  const semOrcamento = useMemo(() => {
    const comOrcamento = new Set(view.orcamentos.map((o) => `${o.escopo}:${o.categoria}`))
    const resultado: { categoria: string; escopo: Escopo; valor: number }[] = []
    for (const [chave, valor] of gastoPorEscopo.entries()) {
      if (valor <= 0) continue
      if (comOrcamento.has(chave)) continue
      const [escopo, categoria] = chave.split(':')
      resultado.push({ categoria, escopo: escopo as Escopo, valor })
    }
    return resultado.sort((a, b) => b.valor - a.valor)
  }, [gastoPorEscopo, view.orcamentos])

  function abrirNovoOrcamento(categoria?: string) {
    setOrcEditing(null)
    setOrcCategoriaInicial(categoria ?? null)
    setOrcModalOpen(true)
  }

  function abrirEdicaoOrcamento(o: OrcamentoTipo) {
    setOrcEditing(o)
    setOrcCategoriaInicial(null)
    setOrcModalOpen(true)
  }

  async function handleRemoverOrcamento(o: OrcamentoTipo) {
    const ok = window.confirm(`Excluir o orçamento de ${o.categoria}?`)
    if (!ok) return
    setErro(null)
    try {
      await removeOrcamento(o.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir o orçamento.')
    }
  }

  function abrirNovaMeta() {
    setMetaEditing(null)
    setMetaModalOpen(true)
  }

  function abrirEdicaoMeta(m: Meta) {
    setMetaEditing(m)
    setMetaModalOpen(true)
  }

  async function handleRemoverMeta(m: Meta) {
    const ok = window.confirm(`Excluir a meta "${m.nome}"?`)
    if (!ok) return
    setErro(null)
    try {
      await removeMeta(m.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir a meta.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Orçamento e metas"
        subtitle="Defina limites por categoria e acompanhe seus objetivos"
        action={
          <Button onClick={() => abrirNovoOrcamento()}>
            <Plus size={16} strokeWidth={2} />
            Novo orçamento
          </Button>
        }
      />

      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMes((m) => addMonthsKey(m, -1))}
          className="rounded-lg border border-line p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <span className="font-display text-base font-medium text-ink capitalize min-w-[9rem] text-center">
          {monthLabel(mes)}
        </span>
        <button
          type="button"
          onClick={() => setMes((m) => addMonthsKey(m, 1))}
          className="rounded-lg border border-line p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      {erro && (
        <div className="mb-4">
          <ErrorNote message={erro} />
        </div>
      )}

      <section className="mb-12">
        <h2 className="font-display text-lg font-medium text-ink mb-4">Orçamento por categoria</h2>

        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Stat label="Orçado" value={brl(totalOrcado)} />
            <Stat label="Gasto" value={brl(totalGasto)} tone={totalGasto > totalOrcado && totalOrcado > 0 ? 'expense' : 'default'} />
            <Stat
              label="Disponível"
              value={brl(totalDisponivel)}
              tone={totalDisponivel < 0 ? 'expense' : 'income'}
            />
          </div>
        </Card>

        {view.orcamentos.length === 0 ? (
          <EmptyState
            icon={<Wallet size={24} strokeWidth={1.5} />}
            title="Nenhum orçamento definido"
            text="Crie um limite mensal por categoria para acompanhar seus gastos."
            action={
              <Button variant="ghost" onClick={() => abrirNovoOrcamento()}>
                <Plus size={16} strokeWidth={2} />
                Novo orçamento
              </Button>
            }
          />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {view.orcamentos.map((o) => {
                const gasto = gastoDe(o)
                const pct = percent(gasto, o.limite)
                const restante = o.limite - gasto
                return (
                  <li key={o.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">{o.categoria}</span>
                          <ScopeBadge escopo={o.escopo} />
                        </div>
                        <div className="mt-1 text-xs text-soft tabular">
                          {brl(gasto)} de {brl(o.limite)}
                        </div>
                        <div className="mt-2 max-w-md">
                          <ProgressBar value={pct} tone={toneFor(pct)} />
                        </div>
                        <div className={`mt-1.5 text-xs tabular ${restante < 0 ? 'text-expense' : 'text-soft'}`}>
                          {restante < 0 ? `Estourou em ${brl(Math.abs(restante))}` : `Restam ${brl(restante)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => abrirEdicaoOrcamento(o)}
                          className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          aria-label="Editar orçamento"
                        >
                          <Pencil size={16} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoverOrcamento(o)}
                          className="rounded-lg p-2 text-soft transition duration-200 hover:bg-expense/10 hover:text-expense focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          aria-label="Excluir orçamento"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {semOrcamento.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-wide text-soft mb-2">Sem orçamento</h3>
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {semOrcamento.map((s) => (
                  <li
                    key={`${s.escopo}:${s.categoria}`}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink">{s.categoria}</span>
                      <ScopeBadge escopo={s.escopo} />
                      <span className="text-xs text-soft tabular">{brl(s.valor)} gastos</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => abrirNovoOrcamento(s.categoria)}>
                      Definir limite
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-medium text-ink">Metas</h2>
          <Button variant="ghost" size="sm" onClick={abrirNovaMeta}>
            <Plus size={16} strokeWidth={2} />
            Nova meta
          </Button>
        </div>

        {view.metas.length === 0 ? (
          <EmptyState
            icon={<Target size={24} strokeWidth={1.5} />}
            title="Nenhuma meta cadastrada"
            text="Defina um objetivo e acompanhe o quanto falta para chegar lá."
            action={
              <Button variant="ghost" onClick={abrirNovaMeta}>
                <Plus size={16} strokeWidth={2} />
                Nova meta
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {view.metas.map((m) => {
              const pct = percent(m.valor_atual, m.valor_alvo)
              const falta = Math.max(0, m.valor_alvo - m.valor_atual)
              const concluida = m.valor_alvo > 0 && m.valor_atual >= m.valor_alvo
              const meses = m.prazo ? monthsUntil(m.prazo) : 0
              const porMes = meses > 0 && falta > 0 ? falta / meses : 0
              return (
                <Card key={m.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-medium text-ink truncate">{m.nome}</span>
                        <ScopeBadge escopo={m.escopo} />
                      </div>
                      {m.prazo ? (
                        <div className="mt-1 text-xs text-soft">Prazo: {fmtDate(m.prazo)}</div>
                      ) : (
                        <div className="mt-1 text-xs text-soft">Sem prazo definido</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirEdicaoMeta(m)}
                        className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-label="Editar meta"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoverMeta(m)}
                        className="rounded-lg p-2 text-soft transition duration-200 hover:bg-expense/10 hover:text-expense focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-label="Excluir meta"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ProgressBar value={pct} tone={concluida ? 'income' : 'primary'} />
                    <div className="mt-2 flex items-center justify-between text-xs text-soft tabular">
                      <span>
                        {brl(m.valor_atual)} de {brl(m.valor_alvo)}
                      </span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                  </div>

                  {concluida ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-income">
                      <Check size={16} strokeWidth={2} />
                      Meta alcançada
                    </div>
                  ) : porMes > 0 ? (
                    <div className="mt-3 text-xs text-soft">
                      Guarde {brl(porMes)} por mês para chegar a tempo
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <Button variant="ghost" size="sm" onClick={() => setValorModalMeta(m)}>
                      <Plus size={16} strokeWidth={2} />
                      Adicionar valor
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <OrcamentoModal
        open={orcModalOpen}
        onClose={() => setOrcModalOpen(false)}
        initial={orcEditing}
        categoriaInicial={orcCategoriaInicial}
        orcamentos={view.orcamentos}
        onSave={async (dados, id) => {
          if (id) await updateOrcamento(id, dados)
          else await addOrcamento(dados)
        }}
      />

      <MetaModal
        open={metaModalOpen}
        onClose={() => setMetaModalOpen(false)}
        initial={metaEditing}
        onSave={async (dados, id) => {
          if (id) await updateMeta(id, dados)
          else await addMeta(dados)
        }}
      />

      <ValorMetaModal
        meta={valorModalMeta}
        onClose={() => setValorModalMeta(null)}
        onSave={async (valor) => {
          if (!valorModalMeta) return
          await updateMeta(valorModalMeta.id, { valor_atual: valorModalMeta.valor_atual + valor })
        }}
      />
    </div>
  )
}

type OrcamentoModalProps = {
  open: boolean
  onClose: () => void
  initial: OrcamentoTipo | null
  categoriaInicial: string | null
  orcamentos: OrcamentoTipo[]
  onSave: (dados: { categoria: string; limite: number; escopo: Escopo }, id: string | null) => Promise<void>
}

function OrcamentoModal({ open, onClose, initial, categoriaInicial, orcamentos, onSave }: OrcamentoModalProps) {
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0])
  const [limite, setLimite] = useState('')
  const [escopo, setEscopo] = useState<Escopo>('pessoal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    if (initial) {
      setCategoria(initial.categoria)
      setLimite(String(initial.limite))
      setEscopo(initial.escopo)
    } else {
      setCategoria(categoriaInicial ?? CATEGORIAS_DESPESA[0])
      setLimite('')
      setEscopo('pessoal')
    }
  }, [open, initial, categoriaInicial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const num = Number(limite)
    if (!limite.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Informe um limite maior que zero.')
      return
    }
    const duplicado = orcamentos.some(
      (o) => o.categoria === categoria && o.escopo === escopo && o.id !== initial?.id,
    )
    if (duplicado) {
      setError('Já existe um orçamento para essa categoria neste escopo.')
      return
    }
    setSaving(true)
    try {
      await onSave({ categoria, limite: Math.round(num * 100) / 100, escopo }, initial?.id ?? null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o orçamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar orçamento' : 'Novo orçamento'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Categoria">
          <select className={inputClass} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS_DESPESA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Limite mensal">
          <input
            className={inputClass + ' tabular'}
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="0,00"
            autoFocus
          />
        </Field>

        <Field label="Escopo">
          <Segmented options={ESCOPO_OPTIONS} value={escopo} onChange={(v) => setEscopo(v as Escopo)} />
        </Field>

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

type MetaModalProps = {
  open: boolean
  onClose: () => void
  initial: Meta | null
  onSave: (
    dados: { nome: string; valor_alvo: number; valor_atual: number; prazo: string | null; escopo: Escopo },
    id: string | null,
  ) => Promise<void>
}

function MetaModal({ open, onClose, initial, onSave }: MetaModalProps) {
  const [nome, setNome] = useState('')
  const [valorAlvo, setValorAlvo] = useState('')
  const [valorAtual, setValorAtual] = useState('')
  const [prazo, setPrazo] = useState('')
  const [escopo, setEscopo] = useState<Escopo>('pessoal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    if (initial) {
      setNome(initial.nome)
      setValorAlvo(String(initial.valor_alvo))
      setValorAtual(String(initial.valor_atual))
      setPrazo(initial.prazo ? initial.prazo.slice(0, 10) : '')
      setEscopo(initial.escopo)
    } else {
      setNome('')
      setValorAlvo('')
      setValorAtual('')
      setPrazo('')
      setEscopo('pessoal')
    }
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nome.trim()) {
      setError('Dê um nome para a meta.')
      return
    }
    const alvo = Number(valorAlvo)
    if (!valorAlvo.trim() || !Number.isFinite(alvo) || alvo <= 0) {
      setError('Informe um valor alvo maior que zero.')
      return
    }
    const atual = valorAtual.trim() ? Number(valorAtual) : 0
    if (!Number.isFinite(atual) || atual < 0) {
      setError('O valor atual não pode ser negativo.')
      return
    }
    setSaving(true)
    try {
      await onSave(
        {
          nome: nome.trim(),
          valor_alvo: Math.round(alvo * 100) / 100,
          valor_atual: Math.round(atual * 100) / 100,
          prazo: prazo ? prazo : null,
          escopo,
        },
        initial?.id ?? null,
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar a meta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar meta' : 'Nova meta'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input
            className={inputClass}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Reserva de emergência"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor alvo">
            <input
              className={inputClass + ' tabular'}
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={valorAlvo}
              onChange={(e) => setValorAlvo(e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <Field label="Valor atual">
            <input
              className={inputClass + ' tabular'}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={valorAtual}
              onChange={(e) => setValorAtual(e.target.value)}
              placeholder="0,00"
            />
          </Field>
        </div>

        <Field label="Prazo (opcional)">
          <input
            className={inputClass}
            type="date"
            min={todayISO()}
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
          />
        </Field>

        <Field label="Escopo">
          <Segmented options={ESCOPO_OPTIONS} value={escopo} onChange={(v) => setEscopo(v as Escopo)} />
        </Field>

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

type ValorMetaModalProps = {
  meta: Meta | null
  onClose: () => void
  onSave: (valor: number) => Promise<void>
}

function ValorMetaModal({ meta, onClose, onSave }: ValorMetaModalProps) {
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!meta) return
    setValor('')
    setError(null)
    setSaving(false)
  }, [meta])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const num = Number(valor)
    if (!valor.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    try {
      await onSave(Math.round(num * 100) / 100)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui adicionar o valor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={meta !== null} onClose={onClose} title={meta ? `Adicionar valor a ${meta.nome}` : 'Adicionar valor'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Valor a adicionar">
          <input
            className={inputClass + ' tabular'}
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            autoFocus
          />
        </Field>

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
