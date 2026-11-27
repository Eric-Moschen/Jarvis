import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import { useFinance } from '../lib/FinanceContext'
import { brl, fmtDate, openInvoice, percent, usedLimit } from '../lib/finance'
import type { Cartao, Escopo } from '../lib/types'
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

export function Cartoes() {
  const { view, all, escopo, removeCartao } = useFinance()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cartao | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const resumo = useMemo(() => {
    let fatura = 0
    let limite = 0
    for (const c of view.cartoes) {
      fatura += openInvoice(c, all.transacoes).total
      limite += c.limite
    }
    return { fatura, limite, disponivel: Math.max(0, limite - fatura) }
  }, [view.cartoes, all.transacoes])

  function abrirNovo() {
    setEditing(null)
    setModalOpen(true)
  }

  function abrirEdicao(cartao: Cartao) {
    setEditing(cartao)
    setModalOpen(true)
  }

  async function handleRemover(cartao: Cartao) {
    const ok = window.confirm(
      `Excluir o cartão "${cartao.nome}"? Os lançamentos continuam existindo, só ficam sem cartão.`,
    )
    if (!ok) return
    setErro(null)
    try {
      await removeCartao(cartao.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir o cartão.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Cartões e faturas"
        subtitle="Limite, fatura aberta e vencimentos"
        action={
          <Button onClick={abrirNovo}>
            <Plus size={16} strokeWidth={2} />
            Novo cartão
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Stat label="Fatura total aberta" value={brl(resumo.fatura)} tone={resumo.fatura > 0 ? 'primary' : 'default'} />
          <Stat label="Limite total" value={brl(resumo.limite)} />
          <Stat label="Disponível" value={brl(resumo.disponivel)} tone={resumo.disponivel > 0 ? 'income' : 'expense'} />
        </div>
      </Card>

      {erro && (
        <div className="mb-4">
          <ErrorNote message={erro} />
        </div>
      )}

      {view.cartoes.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={28} strokeWidth={1.5} />}
          title="Nenhum cartão cadastrado"
          text="Cadastre um cartão para acompanhar a fatura aberta e o limite disponível."
          action={
            <Button variant="ghost" onClick={abrirNovo}>
              <Plus size={16} strokeWidth={2} />
              Novo cartão
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {view.cartoes.map((cartao) => {
            const fatura = openInvoice(cartao, all.transacoes)
            const usado = usedLimit(cartao, all.transacoes)
            const pct = percent(usado, cartao.limite)
            const tone = pct > 100 ? 'expense' : pct > 80 ? 'warn' : 'primary'
            const disponivel = Math.max(0, cartao.limite - usado)
            const aberto = expandido === cartao.id
            return (
              <Card key={cartao.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCard size={18} strokeWidth={1.75} className="text-soft shrink-0" />
                      <h2 className="font-display text-lg font-medium text-ink truncate">{cartao.nome}</h2>
                    </div>
                    <div className="mt-2">
                      <ScopeBadge escopo={cartao.escopo} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(cartao)}
                      className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      aria-label="Editar cartão"
                    >
                      <Pencil size={16} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemover(cartao)}
                      className="rounded-lg p-2 text-soft transition duration-200 hover:bg-expense/10 hover:text-expense focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      aria-label="Excluir cartão"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-soft">Fatura aberta</div>
                  <div className="font-display text-2xl tabular text-ink mt-1">{brl(fatura.total)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
                    <span>Fecha em {fmtDate(fatura.fim)}</span>
                    <span>Vence em {fmtDate(fatura.vencimento)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <ProgressBar value={pct} tone={tone} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-soft">
                    <span className="tabular">
                      Disponível {brl(disponivel)} de {brl(cartao.limite)}
                    </span>
                    <span className="tabular">{Math.round(pct)}% do limite</span>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setExpandido(aberto ? null : cartao.id)}
                    className="inline-flex items-center gap-1.5 text-sm text-primary transition duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg"
                  >
                    {aberto ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
                    Ver lançamentos da fatura
                  </button>

                  {aberto && (
                    <div className="mt-3 border-t border-line pt-3">
                      {fatura.itens.length === 0 ? (
                        <p className="text-sm text-soft">Nenhuma compra nesta fatura</p>
                      ) : (
                        <ul className="divide-y divide-line">
                          {fatura.itens.map((t) => (
                            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm text-ink">{t.descricao}</div>
                                <div className="text-xs text-soft">
                                  {fmtDate(t.data)} · {t.categoria}
                                </div>
                              </div>
                              <span className="tabular text-sm text-expense shrink-0">{brl(t.valor)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-sm text-soft">
        Para registrar uma compra no cartão, use + Lançamento e escolha o cartão.
      </p>

      <CartaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        escopoAtual={escopo}
      />
    </div>
  )
}

type CartaoModalProps = {
  open: boolean
  onClose: () => void
  initial: Cartao | null
  escopoAtual: 'todos' | Escopo
}

function CartaoModal({ open, onClose, initial, escopoAtual }: CartaoModalProps) {
  const { addCartao, updateCartao } = useFinance()

  const [nome, setNome] = useState('')
  const [limite, setLimite] = useState('')
  const [fechamento, setFechamento] = useState('1')
  const [vencimento, setVencimento] = useState('10')
  const [escopoSel, setEscopoSel] = useState<Escopo>('pessoal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    if (initial) {
      setNome(initial.nome)
      setLimite(String(initial.limite))
      setFechamento(String(initial.dia_fechamento))
      setVencimento(String(initial.dia_vencimento))
      setEscopoSel(initial.escopo)
    } else {
      setNome('')
      setLimite('')
      setFechamento('1')
      setVencimento('10')
      setEscopoSel(escopoAtual === 'todos' ? 'pessoal' : escopoAtual)
    }
  }, [open, initial, escopoAtual])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nome.trim()) {
      setError('Dê um nome ao cartão.')
      return
    }
    const limiteNum = Number(limite)
    if (!limite.trim() || !Number.isFinite(limiteNum) || limiteNum < 0) {
      setError('Informe um limite maior ou igual a zero.')
      return
    }
    const fech = Number(fechamento)
    if (!Number.isInteger(fech) || fech < 1 || fech > 31) {
      setError('O dia de fechamento deve ser um inteiro de 1 a 31.')
      return
    }
    const venc = Number(vencimento)
    if (!Number.isInteger(venc) || venc < 1 || venc > 31) {
      setError('O dia de vencimento deve ser um inteiro de 1 a 31.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        limite: Math.round(limiteNum * 100) / 100,
        dia_fechamento: fech,
        dia_vencimento: venc,
        escopo: escopoSel,
      }
      if (initial) {
        await updateCartao(initial.id, payload)
      } else {
        await addCartao(payload)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o cartão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar cartão' : 'Novo cartão'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input
            className={inputClass}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Cartão corporativo"
            autoFocus
          />
        </Field>

        <Field label="Limite">
          <input
            className={inputClass + ' tabular'}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="0,00"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dia de fechamento" hint="De 1 a 31">
            <input
              className={inputClass + ' tabular'}
              type="number"
              min="1"
              max="31"
              step="1"
              value={fechamento}
              onChange={(e) => setFechamento(e.target.value)}
            />
          </Field>
          <Field label="Dia de vencimento" hint="De 1 a 31">
            <input
              className={inputClass + ' tabular'}
              type="number"
              min="1"
              max="31"
              step="1"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </Field>
        </div>

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
