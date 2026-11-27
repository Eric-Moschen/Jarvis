// 1dollar IA. Arquivo gerado: não edite, ele é regravado pela 1dollar.
// A chave da OpenAI fica no servidor da 1dollar (o admin do site salva em ai.saveKey); o navegador nunca a vê.
import { getAuthToken } from './1dollar-auth'

const API = "https://api-v10.1dollar.com.br/project-ai/8b590d6a-aa7e-47ef-852d-3c0ecc714f31"

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) headers.authorization = 'Bearer ' + token
  if (body !== undefined) headers['content-type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Algo deu errado. Tente de novo.'), { status: res.status, code: data.code })
  return data as T
}

export type AiSettings = { imageModel: string; textModel: string; perVisitorDay: number; totalDay: number }
export type AiStatus = { configured: boolean; admin: boolean; hint: string | null; settings: AiSettings | null; usedToday?: number }

/** Lê um arquivo (input type=file) como base64 sem o prefixo, reduzindo fotos grandes no navegador. */
export async function fileToBase64(file: Blob, maxSide = 1536): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
}

export const ai = {
  /** configured: a IA está pronta. admin: quem está logado pode configurar. */
  status: () => call<AiStatus>('/status'),
  /** Gera uma imagem. Com image (base64 de fileToBase64), usa a foto como referência. Devolve um data URL PNG. */
  image: (p: { prompt: string; image?: string; size?: '1024x1024' | '1024x1536' | '1536x1024'; quality?: 'low' | 'medium' | 'high' }) => call<{ image: string; left: number }>('/image', 'POST', p),
  /** Texto (chat). Com json: true, a resposta vem em JSON no campo text (peça o formato no prompt). */
  text: (p: { messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; json?: boolean; maxTokens?: number }) => call<{ text: string }>('/text', 'POST', p),
  /** Só o admin do site (logado com o e-mail da conta 1dollar, confirmado). */
  saveKey: (apiKey: string) => call<{ hint: string }>('/key', 'PUT', { apiKey }),
  removeKey: () => call<{ ok: true }>('/key', 'DELETE'),
  saveSettings: (settings: Partial<AiSettings>) => call<{ settings: AiSettings }>('/settings', 'PATCH', settings),
}
