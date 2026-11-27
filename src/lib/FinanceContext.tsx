import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './1dollar-auth'
import { db } from './1dollar-db'
import { inScope, todayISO } from './finance'
import type {
  Cartao,
  Conta,
  EscopoFiltro,
  Investimento,
  Meta,
  Orcamento,
  Transacao,
} from './types'

const ESCOPO_KEY = 'jarvis-escopo'

interface Lists {
  transacoes: Transacao[]
  contas: Conta[]
  cartoes: Cartao[]
  orcamentos: Orcamento[]
  metas: Meta[]
  investimentos: Investimento[]
}

const EMPTY: Lists = {
  transacoes: [],
  contas: [],
  cartoes: [],
  orcamentos: [],
  metas: [],
  investimentos: [],
}

type TransacaoInput = Omit<Transacao, 'id'>
type ContaInput = Omit<Conta, 'id'>
type CartaoInput = Omit<Cartao, 'id'>
type OrcamentoInput = Omit<Orcamento, 'id'>
type MetaInput = Omit<Meta, 'id'>
type InvestimentoInput = Omit<Investimento, 'id'>

interface FinanceValue {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  escopo: EscopoFiltro
  setEscopo: (e: EscopoFiltro) => void
  all: Lists
  view: Lists
  addTransacao: (input: TransacaoInput) => Promise<void>
  /** Grava várias transações numa única ida ao banco (ex.: parcelas de uma compra). */
  addTransacoes: (inputs: TransacaoInput[]) => Promise<void>
  updateTransacao: (id: string, patch: Partial<TransacaoInput>) => Promise<void>
  removeTransacao: (id: string) => Promise<void>
  /** Apaga todas as parcelas de uma compra parcelada. */
  removeGrupoTransacoes: (grupo: string) => Promise<void>
  addConta: (input: ContaInput) => Promise<void>
  /** Grava várias contas numa única ida ao banco (parcelas ou repetição mensal). */
  addContas: (inputs: ContaInput[]) => Promise<void>
  updateConta: (id: string, patch: Partial<ContaInput>) => Promise<void>
  removeConta: (id: string) => Promise<void>
  /** Apaga as contas pendentes de uma série (as já pagas ficam no histórico). */
  removeGrupoContas: (grupo: string) => Promise<void>
  pagarConta: (id: string) => Promise<void>
  addCartao: (input: CartaoInput) => Promise<void>
  updateCartao: (id: string, patch: Partial<CartaoInput>) => Promise<void>
  removeCartao: (id: string) => Promise<void>
  addOrcamento: (input: OrcamentoInput) => Promise<void>
  updateOrcamento: (id: string, patch: Partial<OrcamentoInput>) => Promise<void>
  removeOrcamento: (id: string) => Promise<void>
  addMeta: (input: MetaInput) => Promise<void>
  updateMeta: (id: string, patch: Partial<MetaInput>) => Promise<void>
  removeMeta: (id: string) => Promise<void>
  addInvestimento: (input: InvestimentoInput) => Promise<void>
  updateInvestimento: (id: string, patch: Partial<InvestimentoInput>) => Promise<void>
  removeInvestimento: (id: string) => Promise<void>
}

const FinanceContext = createContext<FinanceValue | null>(null)

const num = (v: unknown) => Number(v ?? 0)
const date = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : '')
const dateOrNull = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : null)

function normalizeTransacao(r: Record<string, unknown>): Transacao {
  return {
    id: String(r.id),
    tipo: r.tipo === 'receita' ? 'receita' : 'despesa',
    descricao: String(r.descricao ?? ''),
    valor: num(r.valor),
    data: date(r.data),
    categoria: String(r.categoria ?? 'Outros'),
    escopo: r.escopo === 'empresa' ? 'empresa' : 'pessoal',
    cartao_id: r.cartao_id ? String(r.cartao_id) : null,
    ...parcelaFields(r),
  }
}

function parcelaFields(r: Record<string, unknown>) {
  return {
    grupo_parcela: r.grupo_parcela ? String(r.grupo_parcela) : null,
    parcela_num: r.parcela_num == null ? null : num(r.parcela_num),
    parcelas_total: r.parcelas_total == null ? null : num(r.parcelas_total),
  }
}

function normalizeConta(r: Record<string, unknown>): Conta {
  return {
    id: String(r.id),
    tipo: r.tipo === 'receber' ? 'receber' : 'pagar',
    descricao: String(r.descricao ?? ''),
    valor: num(r.valor),
    vencimento: date(r.vencimento),
    categoria: String(r.categoria ?? 'Outros'),
    escopo: r.escopo === 'empresa' ? 'empresa' : 'pessoal',
    status: r.status === 'pago' ? 'pago' : 'pendente',
    pago_em: dateOrNull(r.pago_em),
    ...parcelaFields(r),
  }
}

function normalizeCartao(r: Record<string, unknown>): Cartao {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ''),
    limite: num(r.limite),
    dia_fechamento: num(r.dia_fechamento),
    dia_vencimento: num(r.dia_vencimento),
    escopo: r.escopo === 'empresa' ? 'empresa' : 'pessoal',
  }
}

function normalizeOrcamento(r: Record<string, unknown>): Orcamento {
  return {
    id: String(r.id),
    categoria: String(r.categoria ?? 'Outros'),
    limite: num(r.limite),
    escopo: r.escopo === 'empresa' ? 'empresa' : 'pessoal',
  }
}

function normalizeMeta(r: Record<string, unknown>): Meta {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ''),
    valor_alvo: num(r.valor_alvo),
    valor_atual: num(r.valor_atual),
    prazo: dateOrNull(r.prazo),
    escopo: r.escopo === 'empresa' ? 'empresa' : 'pessoal',
  }
}

function normalizeInvestimento(r: Record<string, unknown>): Investimento {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ''),
    tipo: String(r.tipo ?? 'Outros'),
    valor_investido: num(r.valor_investido),
    valor_atual: num(r.valor_atual),
    data: date(r.data),
    escopo: r.escopo === 'empresa' ? 'empresa' : 'pessoal',
  }
}

function readEscopo(): EscopoFiltro {
  try {
    const v = localStorage.getItem(ESCOPO_KEY)
    if (v === 'pessoal' || v === 'empresa' || v === 'todos') return v
  } catch {
    /* sem armazenamento */
  }
  return 'todos'
}

function firstDayTwelveMonthsAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

const sortTransacoes = (xs: Transacao[]) => [...xs].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
const sortContas = (xs: Conta[]) => [...xs].sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0))

const toError = (e: unknown) => (e instanceof Error ? e : new Error('Não consegui salvar. Tente de novo.'))

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [all, setAll] = useState<Lists>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [escopo, setEscopoState] = useState<EscopoFiltro>(() => readEscopo())
  const userIdRef = useRef<string | null>(null)

  const setEscopo = useCallback((e: EscopoFiltro) => {
    setEscopoState(e)
    try {
      localStorage.setItem(ESCOPO_KEY, e)
    } catch {
      /* sem armazenamento */
    }
  }, [])

  const load = useCallback(async () => {
    if (!user) {
      setAll(EMPTY)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const desde = firstDayTwelveMonthsAgo()
      const [tx, ct, cr, or, me, iv] = await Promise.all([
        db.from('transacoes').select().gte('data', desde).order('data', { desc: true }).limit(3000),
        db.from('contas').select().order('vencimento').limit(1000),
        db.from('cartoes').select().limit(500),
        db.from('orcamentos').select().limit(500),
        db.from('metas').select().limit(500),
        db.from('investimentos').select().limit(500),
      ])
      setAll({
        transacoes: sortTransacoes((tx as Record<string, unknown>[]).map(normalizeTransacao)),
        contas: sortContas((ct as Record<string, unknown>[]).map(normalizeConta)),
        cartoes: (cr as Record<string, unknown>[]).map(normalizeCartao),
        orcamentos: (or as Record<string, unknown>[]).map(normalizeOrcamento),
        metas: (me as Record<string, unknown>[]).map(normalizeMeta),
        investimentos: (iv as Record<string, unknown>[]).map(normalizeInvestimento),
      })
    } catch (e) {
      setError(toError(e).message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const id = user?.id ?? null
    if (userIdRef.current === id && !loading) return
    userIdRef.current = id
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const reload = useCallback(async () => {
    await load()
  }, [load])

  const view = useMemo<Lists>(
    () => ({
      transacoes: all.transacoes.filter((t) => inScope(t.escopo, escopo)),
      contas: all.contas.filter((c) => inScope(c.escopo, escopo)),
      cartoes: all.cartoes.filter((c) => inScope(c.escopo, escopo)),
      orcamentos: all.orcamentos.filter((o) => inScope(o.escopo, escopo)),
      metas: all.metas.filter((m) => inScope(m.escopo, escopo)),
      investimentos: all.investimentos.filter((i) => inScope(i.escopo, escopo)),
    }),
    [all, escopo],
  )

  const addTransacao = useCallback(async (input: TransacaoInput) => {
    const row: Transacao = { ...input, id: crypto.randomUUID() }
    setAll((s) => ({ ...s, transacoes: sortTransacoes([row, ...s.transacoes]) }))
    try {
      await db.from('transacoes').insert(row)
    } catch (e) {
      setAll((s) => ({ ...s, transacoes: s.transacoes.filter((t) => t.id !== row.id) }))
      throw toError(e)
    }
  }, [])

  const addTransacoes = useCallback(async (inputs: TransacaoInput[]) => {
    if (inputs.length === 0) return
    const rows: Transacao[] = inputs.map((i) => ({ ...i, id: crypto.randomUUID() }))
    const ids = new Set(rows.map((r) => r.id))
    setAll((s) => ({ ...s, transacoes: sortTransacoes([...rows, ...s.transacoes]) }))
    try {
      await db.from('transacoes').insert(rows)
    } catch (e) {
      setAll((s) => ({ ...s, transacoes: s.transacoes.filter((t) => !ids.has(t.id)) }))
      throw toError(e)
    }
  }, [])

  const removeGrupoTransacoes = useCallback(async (grupo: string) => {
    let before: Transacao[] = []
    setAll((s) => {
      before = s.transacoes.filter((t) => t.grupo_parcela === grupo)
      return { ...s, transacoes: s.transacoes.filter((t) => t.grupo_parcela !== grupo) }
    })
    try {
      await db.from('transacoes').delete().eq('grupo_parcela', grupo)
    } catch (e) {
      const prev = before
      setAll((s) => ({ ...s, transacoes: sortTransacoes([...prev, ...s.transacoes]) }))
      throw toError(e)
    }
  }, [])

  const updateTransacao = useCallback(async (id: string, patch: Partial<TransacaoInput>) => {
    let before: Transacao | undefined
    setAll((s) => {
      before = s.transacoes.find((t) => t.id === id)
      return { ...s, transacoes: sortTransacoes(s.transacoes.map((t) => (t.id === id ? { ...t, ...patch } : t))) }
    })
    try {
      await db.from('transacoes').update(patch).eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, transacoes: sortTransacoes(s.transacoes.map((t) => (t.id === id ? prev : t))) }))
      }
      throw toError(e)
    }
  }, [])

  const removeTransacao = useCallback(async (id: string) => {
    let before: Transacao | undefined
    setAll((s) => {
      before = s.transacoes.find((t) => t.id === id)
      return { ...s, transacoes: s.transacoes.filter((t) => t.id !== id) }
    })
    try {
      await db.from('transacoes').delete().eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, transacoes: sortTransacoes([prev, ...s.transacoes]) }))
      }
      throw toError(e)
    }
  }, [])

  const addConta = useCallback(async (input: ContaInput) => {
    const row: Conta = { ...input, id: crypto.randomUUID() }
    setAll((s) => ({ ...s, contas: sortContas([row, ...s.contas]) }))
    try {
      await db.from('contas').insert(row)
    } catch (e) {
      setAll((s) => ({ ...s, contas: s.contas.filter((c) => c.id !== row.id) }))
      throw toError(e)
    }
  }, [])

  const addContas = useCallback(async (inputs: ContaInput[]) => {
    if (inputs.length === 0) return
    const rows: Conta[] = inputs.map((i) => ({ ...i, id: crypto.randomUUID() }))
    const ids = new Set(rows.map((r) => r.id))
    setAll((s) => ({ ...s, contas: sortContas([...rows, ...s.contas]) }))
    try {
      await db.from('contas').insert(rows)
    } catch (e) {
      setAll((s) => ({ ...s, contas: s.contas.filter((c) => !ids.has(c.id)) }))
      throw toError(e)
    }
  }, [])

  const removeGrupoContas = useCallback(async (grupo: string) => {
    let before: Conta[] = []
    setAll((s) => {
      before = s.contas.filter((c) => c.grupo_parcela === grupo && c.status === 'pendente')
      return { ...s, contas: s.contas.filter((c) => !(c.grupo_parcela === grupo && c.status === 'pendente')) }
    })
    try {
      await db.from('contas').delete().eq('grupo_parcela', grupo).eq('status', 'pendente')
    } catch (e) {
      const prev = before
      setAll((s) => ({ ...s, contas: sortContas([...prev, ...s.contas]) }))
      throw toError(e)
    }
  }, [])

  const updateConta = useCallback(async (id: string, patch: Partial<ContaInput>) => {
    let before: Conta | undefined
    setAll((s) => {
      before = s.contas.find((c) => c.id === id)
      return { ...s, contas: sortContas(s.contas.map((c) => (c.id === id ? { ...c, ...patch } : c))) }
    })
    try {
      await db.from('contas').update(patch).eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, contas: sortContas(s.contas.map((c) => (c.id === id ? prev : c))) }))
      }
      throw toError(e)
    }
  }, [])

  const removeConta = useCallback(async (id: string) => {
    let before: Conta | undefined
    setAll((s) => {
      before = s.contas.find((c) => c.id === id)
      return { ...s, contas: s.contas.filter((c) => c.id !== id) }
    })
    try {
      await db.from('contas').delete().eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, contas: sortContas([prev, ...s.contas]) }))
      }
      throw toError(e)
    }
  }, [])

  const pagarConta = useCallback(async (id: string) => {
    const conta = all.contas.find((c) => c.id === id)
    if (!conta) return
    const hoje = todayISO()
    const tx: Transacao = {
      id: crypto.randomUUID(),
      tipo: conta.tipo === 'pagar' ? 'despesa' : 'receita',
      descricao: conta.descricao,
      valor: conta.valor,
      data: hoje,
      categoria: conta.categoria,
      escopo: conta.escopo,
      cartao_id: null,
    }
    setAll((s) => ({
      ...s,
      contas: sortContas(s.contas.map((c) => (c.id === id ? { ...c, status: 'pago', pago_em: hoje } : c))),
      transacoes: sortTransacoes([tx, ...s.transacoes]),
    }))
    try {
      await db.from('contas').update({ status: 'pago', pago_em: hoje }).eq('id', id)
      await db.from('transacoes').insert(tx)
    } catch (e) {
      setAll((s) => ({
        ...s,
        contas: sortContas(s.contas.map((c) => (c.id === id ? conta : c))),
        transacoes: s.transacoes.filter((t) => t.id !== tx.id),
      }))
      throw toError(e)
    }
  }, [all.contas])

  const addCartao = useCallback(async (input: CartaoInput) => {
    const row: Cartao = { ...input, id: crypto.randomUUID() }
    setAll((s) => ({ ...s, cartoes: [row, ...s.cartoes] }))
    try {
      await db.from('cartoes').insert(row)
    } catch (e) {
      setAll((s) => ({ ...s, cartoes: s.cartoes.filter((c) => c.id !== row.id) }))
      throw toError(e)
    }
  }, [])

  const updateCartao = useCallback(async (id: string, patch: Partial<CartaoInput>) => {
    let before: Cartao | undefined
    setAll((s) => {
      before = s.cartoes.find((c) => c.id === id)
      return { ...s, cartoes: s.cartoes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
    })
    try {
      await db.from('cartoes').update(patch).eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, cartoes: s.cartoes.map((c) => (c.id === id ? prev : c)) }))
      }
      throw toError(e)
    }
  }, [])

  const removeCartao = useCallback(async (id: string) => {
    let before: Cartao | undefined
    let beforeTx: Transacao[] = []
    setAll((s) => {
      before = s.cartoes.find((c) => c.id === id)
      beforeTx = s.transacoes.filter((t) => t.cartao_id === id)
      return {
        ...s,
        cartoes: s.cartoes.filter((c) => c.id !== id),
        transacoes: s.transacoes.map((t) => (t.cartao_id === id ? { ...t, cartao_id: null } : t)),
      }
    })
    try {
      await db.from('cartoes').delete().eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        const prevTx = beforeTx
        setAll((s) => ({
          ...s,
          cartoes: [prev, ...s.cartoes],
          transacoes: s.transacoes.map((t) => {
            const original = prevTx.find((x) => x.id === t.id)
            return original ? original : t
          }),
        }))
      }
      throw toError(e)
    }
  }, [])

  const addOrcamento = useCallback(async (input: OrcamentoInput) => {
    const row: Orcamento = { ...input, id: crypto.randomUUID() }
    setAll((s) => ({ ...s, orcamentos: [row, ...s.orcamentos] }))
    try {
      await db.from('orcamentos').insert(row)
    } catch (e) {
      setAll((s) => ({ ...s, orcamentos: s.orcamentos.filter((o) => o.id !== row.id) }))
      throw toError(e)
    }
  }, [])

  const updateOrcamento = useCallback(async (id: string, patch: Partial<OrcamentoInput>) => {
    let before: Orcamento | undefined
    setAll((s) => {
      before = s.orcamentos.find((o) => o.id === id)
      return { ...s, orcamentos: s.orcamentos.map((o) => (o.id === id ? { ...o, ...patch } : o)) }
    })
    try {
      await db.from('orcamentos').update(patch).eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, orcamentos: s.orcamentos.map((o) => (o.id === id ? prev : o)) }))
      }
      throw toError(e)
    }
  }, [])

  const removeOrcamento = useCallback(async (id: string) => {
    let before: Orcamento | undefined
    setAll((s) => {
      before = s.orcamentos.find((o) => o.id === id)
      return { ...s, orcamentos: s.orcamentos.filter((o) => o.id !== id) }
    })
    try {
      await db.from('orcamentos').delete().eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, orcamentos: [prev, ...s.orcamentos] }))
      }
      throw toError(e)
    }
  }, [])

  const addMeta = useCallback(async (input: MetaInput) => {
    const row: Meta = { ...input, id: crypto.randomUUID() }
    setAll((s) => ({ ...s, metas: [row, ...s.metas] }))
    try {
      await db.from('metas').insert(row)
    } catch (e) {
      setAll((s) => ({ ...s, metas: s.metas.filter((m) => m.id !== row.id) }))
      throw toError(e)
    }
  }, [])

  const updateMeta = useCallback(async (id: string, patch: Partial<MetaInput>) => {
    let before: Meta | undefined
    setAll((s) => {
      before = s.metas.find((m) => m.id === id)
      return { ...s, metas: s.metas.map((m) => (m.id === id ? { ...m, ...patch } : m)) }
    })
    try {
      await db.from('metas').update(patch).eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, metas: s.metas.map((m) => (m.id === id ? prev : m)) }))
      }
      throw toError(e)
    }
  }, [])

  const removeMeta = useCallback(async (id: string) => {
    let before: Meta | undefined
    setAll((s) => {
      before = s.metas.find((m) => m.id === id)
      return { ...s, metas: s.metas.filter((m) => m.id !== id) }
    })
    try {
      await db.from('metas').delete().eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, metas: [prev, ...s.metas] }))
      }
      throw toError(e)
    }
  }, [])

  const addInvestimento = useCallback(async (input: InvestimentoInput) => {
    const row: Investimento = { ...input, id: crypto.randomUUID() }
    setAll((s) => ({ ...s, investimentos: [row, ...s.investimentos] }))
    try {
      await db.from('investimentos').insert(row)
    } catch (e) {
      setAll((s) => ({ ...s, investimentos: s.investimentos.filter((i) => i.id !== row.id) }))
      throw toError(e)
    }
  }, [])

  const updateInvestimento = useCallback(async (id: string, patch: Partial<InvestimentoInput>) => {
    let before: Investimento | undefined
    setAll((s) => {
      before = s.investimentos.find((i) => i.id === id)
      return { ...s, investimentos: s.investimentos.map((i) => (i.id === id ? { ...i, ...patch } : i)) }
    })
    try {
      await db.from('investimentos').update(patch).eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, investimentos: s.investimentos.map((i) => (i.id === id ? prev : i)) }))
      }
      throw toError(e)
    }
  }, [])

  const removeInvestimento = useCallback(async (id: string) => {
    let before: Investimento | undefined
    setAll((s) => {
      before = s.investimentos.find((i) => i.id === id)
      return { ...s, investimentos: s.investimentos.filter((i) => i.id !== id) }
    })
    try {
      await db.from('investimentos').delete().eq('id', id)
    } catch (e) {
      if (before) {
        const prev = before
        setAll((s) => ({ ...s, investimentos: [prev, ...s.investimentos] }))
      }
      throw toError(e)
    }
  }, [])

  const value = useMemo<FinanceValue>(
    () => ({
      loading,
      error,
      reload,
      escopo,
      setEscopo,
      all,
      view,
      addTransacao,
      addTransacoes,
      updateTransacao,
      removeTransacao,
      removeGrupoTransacoes,
      addConta,
      addContas,
      updateConta,
      removeConta,
      removeGrupoContas,
      pagarConta,
      addCartao,
      updateCartao,
      removeCartao,
      addOrcamento,
      updateOrcamento,
      removeOrcamento,
      addMeta,
      updateMeta,
      removeMeta,
      addInvestimento,
      updateInvestimento,
      removeInvestimento,
    }),
    [
      loading,
      error,
      reload,
      escopo,
      setEscopo,
      all,
      view,
      addTransacao,
      addTransacoes,
      updateTransacao,
      removeTransacao,
      removeGrupoTransacoes,
      addConta,
      addContas,
      updateConta,
      removeConta,
      removeGrupoContas,
      pagarConta,
      addCartao,
      updateCartao,
      removeCartao,
      addOrcamento,
      updateOrcamento,
      removeOrcamento,
      addMeta,
      updateMeta,
      removeMeta,
      addInvestimento,
      updateInvestimento,
      removeInvestimento,
    ],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance(): FinanceValue {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance precisa estar dentro de FinanceProvider')
  return ctx
}
