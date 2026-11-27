import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useFinance } from '../lib/FinanceContext'
import { brl, daysUntil, fmtDate, todayISO } from '../lib/finance'
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  type Conta,
  type Escopo,
} from '../lib/types'
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

type Aba = 'pagar' | 'receber'
type StatusFiltro = 'pendentes' | 'pagas' | 'todas'

const ABA_OPTIONS = [
  { value: 'pagar', label: 'A pagar' },
  { value: 'receber', label: 'A receber' },
]

const STATUS_OPTIONS = [
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'pagas', label: 'Pagas' },
  { value: 'todas', label: 'Todas' },
]

function prazoLabel(conta: Conta): { texto: string; classe: string } {
  if (conta.status === 'pago') {
    const verbo = conta.tipo === 'pagar' ? 'Paga em' : 'Recebida em'
    const data = conta.pago_em ? fmtDate(conta.pago_em) : fmtDate(conta.vencimento)
    return { texto: `${verbo} ${data}`, classe: 'text-income' }
  }
  const dias = daysUntil(conta.vencimento)
  if (dias < 0) return { texto: `Atrasada há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`, classe: 'text-expense' }
  if (dias === 0) return { texto: 'Vence hoje', classe: 'text-warn' }
  return { texto: `Em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, classe: 'text-soft' }
}

function addMonthsISO(iso: string, delta: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const target = new Date(y, m - 1 + delta, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(d, last)
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${target.getFullYear()}-${mm}-${dd}`
}

export function Contas() {
  const { view, escopo, pagarConta, removeConta } = useFinance()
  const [aba, setAba] = useState<Aba>('pagar')
  const [status, setStatus] = useState<StatusFiltro>('pendentes')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Conta | null>(null)
  const [pagandoId, setPagandoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = todayISO()

  const daAba = useMemo(
    () => view.contas.filter((c) => c.tipo === aba),
    [view.contas, aba],
  )

  const pendentes = useMemo(() => daAba.filter((c) => c.status === 'pendente'), [daAba])

  const totalPendente = pendentes.reduce((acc, c) => acc + c.valor, 0)
  const emAtraso = pendentes.filter((c) => c.vencimento < hoje)
  const totalAtraso = emAtraso.reduce((acc, c) => acc + c.valor, 0)
  const proximos7 = pendentes.filter((c) => {
    const d = daysUntil(c.vencimento)
    return d >= 0 && d <= 7
  })
  const totalProximos7 = proximos7.reduce((acc, c) => acc + c.valor, 0)

  const lista = useMemo(() => {
    const filtrada = daAba.filter((c) => {
      if (status === 'pendentes') return c.status === 'pendente'
      if (status === 'pagas') return c.status === 'pago'
      return true
    })
    return [...filtrada].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1
      if (a.status === 'pendente') return a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0
      return a.vencimento > b.vencimento ? -1 : a.vencimento < b.vencimento ? 1 : 0
    })
  }, [daAba, status])

  function abrirNova() {
    setEditing(null)
    setModalOpen(true)
  }

  function abrirEdicao(conta: Conta) {
    setEditing(conta)
    setModalOpen(true)
  }

  async function handlePagar(conta: Conta) {
    setErro(null)
    setPagandoId(conta.id)
    try {
      await pagarConta(conta.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui marcar a conta.')
    } finally {
      setPagandoId(null)
    }
  }

  async function handleRemover(conta: Conta) {
    const ok = window.confirm(`Excluir a conta "${conta.descricao}"?`)
    if (!ok) return
    setErro(null)
    try {
      await removeConta(conta.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir a conta.')
    }
  }

  const rotuloAcao = aba === 'pagar' ? 'Marcar como paga' : 'Marcar como recebida'

  return (
    <div>
      <PageHeader
        title="Contas a pagar e a receber"
        subtitle="Nunca mais perca um vencimento"
        action={
          <Button onClick={abrirNova}>
            <Plus size={16} strokeWidth={2} />
            Nova conta
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented options={ABA_OPTIONS} value={aba} onChange={(v) => setAba(v as Aba)} />
        <Segmented options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v as StatusFiltro)} />
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Stat label="Total pendente" value={brl(totalPendente)} />
          <Stat
            label="Em atraso"
            value={brl(totalAtraso)}
            tone={totalAtraso > 0 ? 'expense' : 'default'}
            hint={emAtraso.length > 0 ? `${emAtraso.length} ${emAtraso.length === 1 ? 'conta' : 'contas'}` : 'Nada atrasado'}
          />
          <Stat
            label="Próximos 7 dias"
            value={brl(totalProximos7)}
            hint={proximos7.length > 0 ? `${proximos7.length} ${proximos7.length === 1 ? 'conta' : 'contas'}` : 'Semana livre'}
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
          title="Nenhuma conta por aqui"
          text={
            status === 'pendentes'
              ? 'Cadastre uma conta para acompanhar o vencimento.'
              : 'Nada encontrado com esse filtro.'
          }
          action={
            <Button variant="ghost" onClick={abrirNova}>
              <Plus size={16} strokeWidth={2} />
              Nova conta
            </Button>
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {lista.map((conta) => {
              const prazo = prazoLabel(conta)
              const paga = conta.status === 'pago'
              return (
                <li key={conta.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{conta.descricao}</span>
                      <ScopeBadge escopo={conta.escopo} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-soft">
                      <span>{conta.categoria}</span>
                      <span className="tabular">{fmtDate(conta.vencimento)}</span>
                      <span className={prazo.classe}>{prazo.texto}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="tabular font-display text-base text-ink">{brl(conta.valor)}</span>
                    <div className="flex items-center gap-1">
                      {paga ? (
                        <span className="flex h-9 items-center px-2 text-income" aria-label="Concluída">
                          <Check size={18} strokeWidth={2} />
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handlePagar(conta)}
                          disabled={pagandoId === conta.id}
                        >
                          {pagandoId === conta.id ? 'Salvando...' : rotuloAcao}
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirEdicao(conta)}
                        className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-label="Editar conta"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemover(conta)}
                        className="rounded-lg p-2 text-soft transition duration-200 hover:bg-expense/10 hover:text-expense focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-label="Excluir conta"
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

      <ContaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        abaAtual={aba}
        escopoAtual={escopo}
      />
    </div>
  )
}

type ContaModalProps = {
  open: boolean
  onClose: () => void
  initial: Conta | null
  abaAtual: Aba
  escopoAtual: 'todos' | Escopo
}

function ContaModal({ open, onClose, initial, abaAtual, escopoAtual }: ContaModalProps) {
  const { addConta, updateConta } = useFinance()

  const [tipo, setTipo] = useState<Aba>('pagar')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(todayISO())
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0])
  const [escopoSel, setEscopoSel] = useState<Escopo>('pessoal')
  const [repetir, setRepetir] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    if (initial) {
      setTipo(initial.tipo)
      setDescricao(initial.descricao)
      setValor(String(initial.valor))
      setVencimento(initial.vencimento.slice(0, 10))
      setCategoria(initial.categoria)
      setEscopoSel(initial.escopo)
      setRepetir('1')
    } else {
      setTipo(abaAtual)
      setDescricao('')
      setValor('')
      setVencimento(todayISO())
      setCategoria(abaAtual === 'pagar' ? CATEGORIAS_DESPESA[0] : CATEGORIAS_RECEITA[0])
      setEscopoSel(escopoAtual === 'todos' ? 'pessoal' : escopoAtual)
      setRepetir('1')
    }
  }, [open, initial, abaAtual, escopoAtual])

  const categorias = tipo === 'pagar' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA

  function changeTipo(next: Aba) {
    setTipo(next)
    const lista = next === 'pagar' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA
    if (!lista.includes(categoria)) setCategoria(lista[0])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const num = Number(valor)
    if (!descricao.trim()) {
      setError('Descreva a conta.')
      return
    }
    if (!valor.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    if (!vencimento) {
      setError('Escolha a data de vencimento.')
      return
    }
    const n = initial ? 1 : Math.max(1, Math.min(24, Math.round(Number(repetir) || 1)))
    const valorFinal = Math.round(num * 100) / 100

    setSaving(true)
    try {
      if (initial) {
        await updateConta(initial.id, {
          tipo,
          descricao: descricao.trim(),
          valor: valorFinal,
          vencimento,
          categoria,
          escopo: escopoSel,
        })
      } else {
        const base = descricao.trim()
        const criacoes = Array.from({ length: n }, (_, i) => {
          const venc = addMonthsISO(vencimento, i)
          const desc = n > 1 ? `${base} (${i + 1}/${n})` : base
          return addConta({
            tipo,
            descricao: desc,
            valor: valorFinal,
            vencimento: venc,
            categoria,
            escopo: escopoSel,
            status: 'pendente',
            pago_em: null,
          })
        })
        await Promise.all(criacoes)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar a conta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar conta' : 'Nova conta'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tipo">
          <Segmented
            options={ABA_OPTIONS}
            value={tipo}
            onChange={(v) => changeTipo(v as Aba)}
          />
        </Field>

        <Field label="Descrição">
          <input
            className={inputClass}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === 'pagar' ? 'Ex.: Aluguel do escritório' : 'Ex.: Pagamento de cliente'}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor">
            <input
              className={inputClass + ' tabular'}
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <Field label="Vencimento">
            <input
              className={inputClass}
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Categoria">
          <select className={inputClass} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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

        {!initial && (
          <Field label="Repetir por quantos meses" hint="De 1 a 24. Cada mês vira uma conta separada.">
            <input
              className={inputClass + ' tabular'}
              type="number"
              min="1"
              max="24"
              step="1"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
            />
          </Field>
        )}

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
