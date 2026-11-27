// 1dollar Auth. Arquivo gerado: não edite, ele é regravado pela 1dollar.
import { useEffect, useState } from 'react'

const API = "https://api-v10.1dollar.com.br/project-auth/8b590d6a-aa7e-47ef-852d-3c0ecc714f31"
const TOKEN_KEY = "1dollar_auth_8b590d6a-aa7e-47ef-852d-3c0ecc714f31"
const VERIFIER_KEY = TOKEN_KEY + '_verifier'

export type AuthUser = { id: string; email: string; name: string | null; avatarUrl: string | null; emailVerified: boolean }
export type OAuthProvider = 'google' | 'github' | 'apple'

let memoryToken: string | null = null
let current: AuthUser | null = null
let ready: Promise<AuthUser | null> | null = null
const listeners = new Set<(user: AuthUser | null) => void>()

// Dentro de iframes o navegador pode bloquear o armazenamento: a memória garante a sessão até recarregar.
function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken
  } catch {
    return memoryToken
  }
}
function writeToken(token: string | null) {
  memoryToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* segue só em memória */
  }
}
/** Para o 1dollar Database saber quem está logado. */
export const getAuthToken = () => readToken()
function setUser(user: AuthUser | null) {
  current = user
  listeners.forEach((fn) => fn(user))
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = readToken()
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = 'Bearer ' + token
  let res: Response
  try {
    res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Algo deu errado. Tente de novo.'), { status: res.status, code: data.code })
  return data as T
}

async function startSession(p: Promise<{ token: string; user: AuthUser }>) {
  const { token, user } = await p
  writeToken(token)
  setUser(user)
  return user
}

export const signUp = (input: { email: string; password: string; name?: string }) => startSession(call('POST', '/signup', input))
export const signIn = (input: { email: string; password: string }) => startSession(call('POST', '/signin', input))

export async function signOut() {
  await call('POST', '/signout').catch(() => {})
  writeToken(null)
  setUser(null)
}

/** Usuário logado (ou null). Espera a volta de um login social, se houver. */
export function getUser() {
  if (ready) return ready
  ready = (async () => {
    await finishRedirect()
    if (!readToken()) {
      setUser(null)
      return null
    }
    try {
      const { user } = await call<{ user: AuthUser }>('GET', '/me')
      setUser(user)
      return user
    } catch (e) {
      if ((e as { status?: number }).status === 401) writeToken(null)
      setUser(null)
      return null
    }
  })()
  return ready
}

/** { user, loading } sempre atualizado: use para proteger telas. */
export function useAuth() {
  const [user, setState] = useState<AuthUser | null>(current)
  const [loading, setLoading] = useState(!current)
  useEffect(() => {
    listeners.add(setState)
    void getUser().finally(() => setLoading(false))
    return () => void listeners.delete(setState)
  }, [])
  return { user, loading }
}

/** O que está ligado neste projeto: desenhe só estes botões. */
export const getProviders = () => call<{ password: boolean; oauth: OAuthProvider[] }>('GET', '/providers')

export const updateProfile = async (input: { name: string }) => {
  const { user } = await call<{ user: AuthUser }>('PATCH', '/me', input)
  setUser(user)
  return user
}

export const requestPasswordReset = (email: string, redirectTo: string = location.origin + location.pathname) =>
  call<{ ok: true }>('POST', '/password/forgot', { email, redirectTo })
export const resetPassword = (token: string, password: string) => call<{ ok: true }>('POST', '/password/reset', { token, password })

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  return { verifier, challenge }
}

const finishWithCode = (code: string, verifier: string) => startSession(call('POST', '/oauth/exchange', { code, verifier }))

/**
 * Login social. No site publicado vai e volta na mesma aba; dentro de um iframe (o preview do editor)
 * usa uma janela, porque os provedores não abrem em iframe.
 */
export async function signInWithProvider(provider: OAuthProvider, options: { redirectTo?: string } = {}) {
  const inFrame = window.top !== window.self
  // A janela abre antes de qualquer espera: o navegador só permite em resposta direta ao clique.
  const popup = inFrame ? window.open('', '1dollar-auth', 'width=520,height=680') : null
  const { verifier, challenge } = await pkcePair()
  const redirectTo = options.redirectTo ?? location.origin + location.pathname
  let url = API + '/oauth/' + provider + '/start?redirect_to=' + encodeURIComponent(redirectTo) + '&challenge=' + challenge
  if (!popup) {
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    location.href = url
    return new Promise<AuthUser>(() => {})
  }
  // Dentro de um quadro (preview do editor): a janela do provedor perde o vínculo com este site, então o resultado
  // volta pelo servidor. O código só vira sessão com o segredo (verifier) que fica aqui.
  const relay = b64url(crypto.getRandomValues(new Uint8Array(24)))
  url += '&relay=' + relay
  popup.location.href = url
  return new Promise<AuthUser>((resolve, reject) => {
    let finished = false
    let closedChecks = 0
    const started = Date.now()
    const done = () => {
      finished = true
      window.removeEventListener('message', onMessage)
      window.clearInterval(timer)
    }
    const succeed = (code: string) => {
      done()
      try { popup.close() } catch { /* já fechou */ }
      finishWithCode(code, verifier).then(resolve, reject)
    }
    const onMessage = (e: MessageEvent) => {
      if (finished || e.origin !== location.origin || e.data?.type !== '1dollar-auth') return
      if (e.data.code) succeed(e.data.code)
      else {
        done()
        reject(new Error(errorMessage(e.data.error)))
      }
    }
    const timer = window.setInterval(async () => {
      if (finished) return
      try {
        const res = await fetch(API + '/oauth/relay/' + relay)
        if (res.status === 200) {
          const data = (await res.json()) as { code?: string; error?: string }
          if (finished) return
          if (data.code) return succeed(data.code)
          done()
          return reject(new Error(errorMessage(data.error)))
        }
      } catch { /* rede instável: tenta de novo no próximo ciclo */ }
      // Janela fechada sem resultado (algumas consultas de folga) ou 5 minutos sem resposta: cancelado.
      let closed = false
      try { closed = popup.closed } catch { closed = false }
      closedChecks = closed ? closedChecks + 1 : 0
      if (closedChecks >= 4 || Date.now() - started > 5 * 60_000) {
        done()
        reject(new Error('Login cancelado.'))
      }
    }, 1000)
    window.addEventListener('message', onMessage)
  })
}

const AUTH_ERRORS: Record<string, string> = {
  access_denied: 'Login cancelado.',
  email_not_verified: 'Esse provedor não confirmou o seu e-mail. Confirme o e-mail lá ou use outra forma de entrar.',
  provider_unavailable: 'Essa forma de entrar não está disponível.',
}
const errorMessage = (code?: string) => AUTH_ERRORS[code ?? ''] ?? 'Não consegui concluir o login. Tente de novo.'

const svgUri = (svg: string) => 'data:image/svg+xml,' + encodeURIComponent(svg)
const GOOGLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>'
const githubSvg = (fill: string) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="' + fill + '" d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 4.9 18.3 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z"/></svg>'
const appleSvg = (fill: string) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="' + fill + '" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-.9-2.5-3.8ZM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4Z"/></svg>'

/**
 * Logo oficial do provedor, pronto para <img src={providerIcon('google')} alt="" width={18} height={18} />.
 * theme: 'light' para botão de fundo claro (logo do GitHub e da Apple em preto), 'dark' para fundo escuro (em branco).
 * O do Google é colorido e serve nos dois.
 */
export function providerIcon(provider: OAuthProvider, theme: 'light' | 'dark' = 'light') {
  const fill = theme === 'dark' ? '#ffffff' : '#111111'
  if (provider === 'google') return svgUri(GOOGLE_SVG)
  if (provider === 'github') return svgUri(githubSvg(fill))
  return svgUri(appleSvg(fill))
}

/** Nome para o botão: "Continuar com Google". */
export const providerLabel = (provider: OAuthProvider) => ({ google: 'Google', github: 'GitHub', apple: 'Apple' })[provider]

let redirectError: string | null = null
/** Erro do último login social, para mostrar na tela de login. */
export const lastAuthError = () => redirectError

/** Volta do provedor: troca o código pela sessão e limpa a URL. */
async function finishRedirect() {
  const params = new URLSearchParams(location.search)
  const code = params.get('auth_code')
  const error = params.get('auth_error')
  if (!code && !error) return
  if (window.opener && window.opener !== window) {
    window.opener.postMessage({ type: '1dollar-auth', code, error }, location.origin)
    window.close()
    return
  }
  params.delete('auth_code')
  params.delete('auth_error')
  const query = params.toString()
  history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash)
  if (error) {
    redirectError = errorMessage(error)
    return
  }
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  if (!verifier) {
    redirectError = errorMessage()
    return
  }
  await finishWithCode(code as string, verifier).catch(() => {
    redirectError = errorMessage()
  })
}
