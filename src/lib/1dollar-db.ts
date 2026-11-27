// 1dollar Database. Arquivo gerado: não edite, ele é regravado pela 1dollar.
import { getAuthToken } from './1dollar-auth'

const API = "https://api-v10.1dollar.com.br/project-db/8b590d6a-aa7e-47ef-852d-3c0ecc714f31"

async function send(body: { table: string; [key: string]: unknown }) {
  const token = getAuthToken()
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = 'Bearer ' + token
  let res: Response
  try {
    res = await fetch(API + '/' + encodeURIComponent(body.table), { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Algo deu errado. Tente de novo.'), { status: res.status, code: data.code })
  return data
}

type Row = Record<string, any>
type Filter = { column: string; op: string; value: unknown }

class Query<T extends Row> implements PromiseLike<T[]> {
  private body: { table: string; action: string; columns?: string[]; where: Filter[]; order: { column: string; desc?: boolean }[]; limit?: number; offset?: number; values?: unknown }

  constructor(table: string) {
    this.body = { table, action: 'select', where: [], order: [] }
  }

  private filter(column: string, op: string, value: unknown) {
    this.body.where.push({ column, op, value })
    return this
  }

  /** Colunas separadas por vírgula. Sem argumento, traz todas. */
  select(columns?: string) {
    this.body.action = 'select'
    if (columns) this.body.columns = columns.split(',').map((c) => c.trim()).filter(Boolean)
    return this
  }
  insert(values: Partial<T> | Partial<T>[]) {
    this.body.action = 'insert'
    this.body.values = values
    return this
  }
  /** Exige pelo menos um filtro. */
  update(values: Partial<T>) {
    this.body.action = 'update'
    this.body.values = values
    return this
  }
  /** Exige pelo menos um filtro. */
  delete() {
    this.body.action = 'delete'
    return this
  }

  eq(column: string, value: unknown) { return this.filter(column, 'eq', value) }
  neq(column: string, value: unknown) { return this.filter(column, 'neq', value) }
  gt(column: string, value: unknown) { return this.filter(column, 'gt', value) }
  gte(column: string, value: unknown) { return this.filter(column, 'gte', value) }
  lt(column: string, value: unknown) { return this.filter(column, 'lt', value) }
  lte(column: string, value: unknown) { return this.filter(column, 'lte', value) }
  like(column: string, pattern: string) { return this.filter(column, 'like', pattern) }
  ilike(column: string, pattern: string) { return this.filter(column, 'ilike', pattern) }
  in(column: string, values: unknown[]) { return this.filter(column, 'in', values) }
  isNull(column: string) { return this.filter(column, 'is', null) }
  notNull(column: string) { return this.filter(column, 'isNot', null) }

  order(column: string, options: { desc?: boolean } = {}) {
    this.body.order.push({ column, desc: options.desc })
    return this
  }
  limit(n: number) {
    this.body.limit = n
    return this
  }
  offset(n: number) {
    this.body.offset = n
    return this
  }

  /** Primeira linha, ou null se não houver. */
  async first(): Promise<T | null> {
    this.body.limit = 1
    return (await this)[0] ?? null
  }
  /** Quantas linhas passam nos filtros (e nas regras de acesso). */
  async count(): Promise<number> {
    const { count } = await send({ ...this.body, action: 'count', order: [] })
    return count
  }

  then<A = T[], B = never>(done?: ((rows: T[]) => A | PromiseLike<A>) | null, failed?: ((e: any) => B | PromiseLike<B>) | null) {
    return send(this.body).then((r) => r.data as T[]).then(done, failed)
  }
}

/** Ex.: await db.from('tarefas').select().eq('feita', false).order('criada_em', { desc: true }).limit(20) */
export const db = { from: <T extends Row = Row>(table: string) => new Query<T>(table) }
