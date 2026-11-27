// 1dollar Storage. Arquivo gerado: não edite, ele é regravado pela 1dollar.
import { getAuthToken } from './1dollar-auth'

const API = "https://cloud.1dollar.ai/storage/v1"
const PROJECT = "8b590d6a-aa7e-47ef-852d-3c0ecc714f31"

export type StoredFile = {
  bucket: 'public' | 'private'
  /** Caminho completo (começa com o id do usuário). Use em remove() e signedUrl(). */
  path: string
  size: number
  contentType: string
  /** Link permanente, só para arquivos públicos. Privados: use signedUrl(). */
  url: string | null
  createdAt: string
  updatedAt: string
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

async function call<T>(method: string, path: string, body?: BodyInit, headers: Record<string, string> = {}): Promise<T> {
  const token = getAuthToken()
  if (token) headers.authorization = 'Bearer ' + token
  let res: Response
  try {
    res = await fetch(API + path, { method, headers, body })
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Algo deu errado. Tente de novo.'), { status: res.status, code: data.code })
  return data as T
}

const safeName = (name: string) =>
  (name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'arquivo').slice(-80)

/**
 * Envia um arquivo do usuário logado (sem login, lança erro). Ele vai para a pasta do usuário.
 * private: true = só ele vê (abra com signedUrl). path: nome dentro da pasta dele; sem path, gera um único.
 * upsert: true regrava se já existir. Fotos JPEG e PNG são otimizadas para WebP no servidor (o path não muda);
 * original: true guarda o arquivo exatamente como veio.
 */
export function upload(file: File | Blob, options: { private?: boolean; path?: string; upsert?: boolean; original?: boolean } = {}) {
  const bucket = options.private ? 'private' : 'public'
  const name = options.path ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '-' + safeName((file as File).name ?? 'arquivo')
  const headers: Record<string, string> = { 'content-type': file.type || 'application/octet-stream' }
  if (options.upsert) headers['x-upsert'] = 'true'
  if (options.original) headers['x-original'] = 'true'
  return call<StoredFile>('POST', '/object/' + PROJECT + '/' + bucket + '/' + encodePath(name.replace(/^\/+/, '')), file, headers)
}

/** Apaga um arquivo do próprio usuário (use o path devolvido por upload ou list). */
export async function remove(path: string, options: { private?: boolean } = {}) {
  await call('DELETE', '/object/' + PROJECT + '/' + (options.private ? 'private' : 'public') + '/' + encodePath(path))
}

/** Arquivos do usuário logado, mais recentes primeiro. prefix é relativo à pasta dele. */
export async function list(options: { private?: boolean; prefix?: string; limit?: number; offset?: number } = {}) {
  const q = new URLSearchParams()
  if (options.prefix) q.set('prefix', options.prefix)
  if (options.limit) q.set('limit', String(options.limit))
  if (options.offset) q.set('offset', String(options.offset))
  const { items } = await call<{ items: StoredFile[] }>('GET', '/list/' + PROJECT + '/' + (options.private ? 'private' : 'public') + '?' + q)
  return items
}

/** Link temporário de um arquivo privado do usuário (padrão: 1 hora). */
export async function signedUrl(path: string, expiresIn = 3600) {
  const { url } = await call<{ url: string }>('POST', '/sign/' + PROJECT, JSON.stringify({ path, expiresIn }), { 'content-type': 'application/json' })
  return url
}

/** Link de um arquivo público a partir do path. */
export const publicUrl = (path: string) => API + '/public/' + PROJECT + '/' + encodePath(path)

/** Ex.: const { url } = await storage.upload(arquivo); const foto = await storage.upload(doc, { private: true }) */
export const storage = { upload, remove, list, signedUrl, publicUrl }
