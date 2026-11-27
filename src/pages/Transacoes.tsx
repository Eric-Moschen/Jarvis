import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CreditCard, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useFinance } from '../lib/FinanceContext'
import {
  addMonthsKey,
  brl,
  currentMonthKey,
  fmtDate,
  monthKey,
  monthLabel,
  monthTotals,
  parseISO,
} from '../lib/finance'
import type { Transacao } from '../lib/types'
import { TransacaoModal } from '../components/TransacaoModal'
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  ScopeBadge,
  Segmented,
  Stat,
  inputClass,
} from '../components/ui'

type TipoFiltro = 'todos' | 'receita' | 'despesa'

const TIPO_OPTIONS: { value: TipoFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'receita', label: 'Receitas' },
  { value: 'despesa', label: 'Despesas' },
]

function diaLabel(iso: string) {
  const d = parseISO(iso)
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function csvCell(value: string) {
  if (/[;"\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

export function Transacoes() {
  const { view, all, removeTransacao } = useFinance()

  const [mes, setMes] = useState<string>(currentMonthKey())
  const [tipo, setTipo] = useState<TipoFiltro>('todos')
  const [categoria, setCategoria] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transacao | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const mesAtual = currentMonthKey()
  const mesMax = addMonthsKey(mesAtual, 1)

  const cartaoNome = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of all.cartoes) map.set(c.id, c.nome)
    return map
  }, [all.cartoes])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const t of view.transacoes) set.add(t.categoria)
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [view.transacoes])

  const doMes = useMemo(
    () => view.transacoes.filter((t) => monthKey(t.data) === mes),
    [view.transacoes, mes],
  )

  const totais = useMemo(() => monthTotals(view.transacoes, mes), [view.transacoes, mes])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return doMes.filter((t) => {
      if (tipo !== 'todos' && t.tipo !== tipo) return false
      if (categoria !== 'todas' && t.categoria !== categoria) return false
      if (q && !t.descricao.toLowerCase().includes(q)) return false
      return true
    })
  }, [doMes, tipo, categoria, busca])

  const grupos = useMemo(() => {
    const map = new Map<string, Transacao[]>()
    for (const t of filtradas) {
      const lista = map.get(t.data)
      if (lista) lista.push(t)
      else map.set(t.data, [t])
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([data, itens]) => ({
        data,
        itens: [...itens].sort((a, b) => b.valor - a.valor),
        total: itens.reduce((acc, t) => acc + (t.tipo === 'receita' ? t.valor : -t.valor), 0),
      }))
  }, [filtradas])

  function abrirNovo() {
    setEditing(undefined)
    setModalOpen(true)
  }

  function abrirEdicao(t: Transacao) {
    setEditing(t)
    setModalOpen(true)
  }

  async function excluir(t: Transacao) {
    if (!window.confirm(`Excluir o lançamento "${t.descricao}"?`)) return
    setError(null)
    try {
      await removeTransacao(t.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui excluir o lançamento.')
    }
  }

  function exportarCsv() {
    const linhas = [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Escopo']]
    for (const t of filtradas) {
      linhas.push([
        fmtDate(t.data),
        t.descricao,
        t.categoria,
        t.tipo === 'receita' ? 'Receita' : 'Despesa',
        t.valor.toFixed(2).replace('.', ','),
        t.escopo === 'empresa' ? 'Empresa' : 'Pessoal',
      ])
    }
    const csv = linhas.map((l) => l.map(csvCell).join(';')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jarvis-lancamentos-${mes}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const podeAvancar = mes < mesMax

  return (
    <div>
      <PageHeader
        title="Lançamentos"
        subtitle="Tudo que entrou e saiu"
        action={
          <Button onClick={abrirNovo}>
            <Plus size={16} strokeWidth={2} />
            Novo lançamento
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMes((m) => addMonthsKey(m, -1))}
                className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[9rem] text-center font-display text-sm font-medium text-ink">
                {monthLabel(mes)}
              </span>
              <button
                type="button"
                onClick={() => setMes((m) => addMonthsKey(m, 1))}
                disabled={!podeAvancar}
                className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-40"
                aria-label="Próximo mês"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <Segmented options={TIPO_OPTIONS} value={tipo} onChange={(v) => setTipo(v as TipoFiltro)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              className={inputClass}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              aria-label="Filtrar por categoria"
            >
              <option value="todas">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-soft"
                aria-hidden="true"
              />
              <input
                className={inputClass + ' pl-9'}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por descrição"
                aria-label="Buscar por descrição"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Stat label="Receitas" value={brl(totais.receitas)} tone="income" />
          <Stat label="Despesas" value={brl(totais.despesas)} tone="expense" />
          <Stat
            label="Saldo"
            value={brl(totais.saldo)}
            tone={totais.saldo >= 0 ? 'income' : 'expense'}
          />
        </div>
      </Card>

      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-soft">
          {filtradas.length} {filtradas.length === 1 ? 'lançamento' : 'lançamentos'}
        </p>
        <Button variant="ghost" size="sm" onClick={exportarCsv} disabled={filtradas.length === 0}>
          <Download size={16} strokeWidth={1.75} />
          Exportar CSV
        </Button>
      </div>

      {grupos.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento neste período"
          text="Ajuste os filtros ou registre um novo lançamento para começar."
          action={
            <Button onClick={abrirNovo}>
              <Plus size={16} strokeWidth={2} />
              Novo lançamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <div key={g.data}>
              <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <span className="text-xs font-medium text-soft">{diaLabel(g.data)}</span>
                <span
                  className={
                    'tabular text-xs ' + (g.total >= 0 ? 'text-income' : 'text-expense')
                  }
                >
                  {g.total >= 0 ? '+' : '-'} {brl(Math.abs(g.total))}
                </span>
              </div>
              <div className="divide-y divide-line">
                {g.itens.map((t) => {
                  const nomeCartao = t.cartao_id ? cartaoNome.get(t.cartao_id) : undefined
                  return (
                    <div
                      key={t.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{t.descricao}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-soft">
                          <span>{t.categoria}</span>
                          <ScopeBadge escopo={t.escopo} />
                          {nomeCartao && (
                            <span className="inline-flex items-center gap-1">
                              <CreditCard size={12} strokeWidth={1.75} aria-hidden="true" />
                              {nomeCartao}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span
                          className={
                            'tabular text-sm font-medium ' +
                            (t.tipo === 'receita' ? 'text-income' : 'text-expense')
                          }
                        >
                          {t.tipo === 'receita' ? '+' : '-'} {brl(t.valor)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEdicao(t)}
                            className="rounded-lg p-2 text-soft transition duration-200 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            aria-label={`Editar ${t.descricao}`}
                          >
                            <Pencil size={16} strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void excluir(t)}
                            className="rounded-lg p-2 text-soft transition duration-200 hover:bg-expense/10 hover:text-expense focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            aria-label={`Excluir ${t.descricao}`}
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <TransacaoModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} />
    </div>
  )
}
