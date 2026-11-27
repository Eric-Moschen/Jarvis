import type { Cartao, EscopoFiltro, Transacao } from './types'

const nf = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const brl = (n: number) => nf.format(Number.isFinite(n) ? n : 0)
export const brlCompact = (n: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())
export const parseISO = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const monthKey = (iso: string) => iso.slice(0, 7)
export const currentMonthKey = () => todayISO().slice(0, 7)
export const addMonthsKey = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export const monthLabel = (key: string, short = false) => {
  const [y, m] = key.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric' })
  return s.replace('.', '')
}
export const fmtDate = (iso: string) => parseISO(iso).toLocaleDateString('pt-BR')
export const daysUntil = (iso: string) =>
  Math.round((parseISO(iso).getTime() - parseISO(todayISO()).getTime()) / 86400000)

export const inScope = (escopo: string, filtro: EscopoFiltro) => filtro === 'todos' || escopo === filtro

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Receitas, despesas e saldo de um mês (YYYY-MM). */
export function monthTotals(tx: Transacao[], key: string) {
  const mes = tx.filter((t) => monthKey(t.data) === key)
  const receitas = sum(mes.filter((t) => t.tipo === 'receita').map((t) => t.valor))
  const despesas = sum(mes.filter((t) => t.tipo === 'despesa').map((t) => t.valor))
  return { receitas, despesas, saldo: receitas - despesas }
}

/** Gasto por categoria (só despesas) em um mês. */
export function spendByCategory(tx: Transacao[], key: string) {
  const map = new Map<string, number>()
  for (const t of tx) {
    if (t.tipo !== 'despesa' || monthKey(t.data) !== key) continue
    map.set(t.categoria, (map.get(t.categoria) ?? 0) + t.valor)
  }
  return [...map.entries()].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor)
}

/** Últimos n meses (inclui o atual), do mais antigo ao mais novo. */
export function lastMonths(n: number) {
  const cur = currentMonthKey()
  return Array.from({ length: n }, (_, i) => addMonthsKey(cur, i - (n - 1)))
}

const clampDay = (y: number, m: number, day: number) => {
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(day, last))
}
const nextDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

/** Ciclo da fatura aberta de um cartão: inicio e fim (inclusive) e data de vencimento. */
export function invoiceCycle(c: Cartao, today = new Date()) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const closeThis = clampDay(y, m, c.dia_fechamento)
  const t = parseISO(toISO(today))
  let fim: Date
  let inicio: Date
  if (t <= closeThis) {
    fim = closeThis
    inicio = nextDay(clampDay(y, m - 1, c.dia_fechamento))
  } else {
    fim = clampDay(y, m + 1, c.dia_fechamento)
    inicio = nextDay(closeThis)
  }
  const venc =
    c.dia_vencimento > c.dia_fechamento
      ? clampDay(fim.getFullYear(), fim.getMonth(), c.dia_vencimento)
      : clampDay(fim.getFullYear(), fim.getMonth() + 1, c.dia_vencimento)
  return { inicio: toISO(inicio), fim: toISO(fim), vencimento: toISO(venc) }
}

/** Valor da fatura aberta (despesas do cartão dentro do ciclo). */
export function openInvoice(c: Cartao, tx: Transacao[], today = new Date()) {
  const cy = invoiceCycle(c, today)
  const itens = tx.filter((t) => t.cartao_id === c.id && t.tipo === 'despesa' && t.data >= cy.inicio && t.data <= cy.fim)
  return { ...cy, itens, total: sum(itens.map((t) => t.valor)) }
}

/** Limite usado: tudo que foi gasto no cartão desde o início do ciclo atual. */
export function usedLimit(c: Cartao, tx: Transacao[], today = new Date()) {
  const cy = invoiceCycle(c, today)
  return sum(tx.filter((t) => t.cartao_id === c.id && t.tipo === 'despesa' && t.data >= cy.inicio).map((t) => t.valor))
}

export function percent(value: number, total: number) {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, (value / total) * 100))
}
