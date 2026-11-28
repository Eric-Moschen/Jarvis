import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, CalendarClock, Layers, LineChart, Sparkles, User } from 'lucide-react'
import type { TipoPerfil } from '../lib/types'
import {
  getProviders,
  lastAuthError,
  providerIcon,
  providerLabel,
  requestPasswordReset,
  resetPassword,
  signIn,
  signInWithProvider,
  signUp,
  useAuth,
  type OAuthProvider,
} from '../lib/1dollar-auth'
import { Button, ErrorNote, Field, inputClass } from '../components/ui'

const BENEFITS: { icon: typeof LineChart; text: string }[] = [
  { icon: LineChart, text: 'Receitas, despesas e fluxo de caixa em tempo real' },
  { icon: CalendarClock, text: 'Contas a pagar e a receber sem esquecer vencimentos' },
  { icon: Sparkles, text: 'Um assistente que responde sobre os seus números' },
]

const DARK_PROVIDERS: OAuthProvider[] = ['github', 'apple']

const TIPOS_CONTA: { value: TipoPerfil; label: string; icon: typeof User }[] = [
  { value: 'pessoal', label: 'Pessoal', icon: User },
  { value: 'empresa', label: 'Empresa', icon: Building2 },
  { value: 'ambos', label: 'Os dois', icon: Layers },
]

/** Exige senha com pelo menos 8 caracteres, letras e números. */
function senhaFraca(s: string): string | null {
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.'
  return null
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      <span className="font-display text-3xl font-semibold text-ink">Jarvis</span>
    </div>
  )
}

export function Login() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [providers, setProviders] = useState<{ password: boolean; oauth: OAuthProvider[] } | null>(null)
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)

  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [tipoConta, setTipoConta] = useState<TipoPerfil | ''>('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const loadProviders = () => {
    setProvidersLoading(true)
    setProvidersError(null)
    getProviders()
      .then((p) => setProviders(p))
      .catch((e: unknown) => setProvidersError(e instanceof Error ? e.message : 'Não consegui carregar as formas de entrar.'))
      .finally(() => setProvidersLoading(false))
  }

  useEffect(() => {
    loadProviders()
    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset_token')
    if (token) setResetToken(token)
    const authError = lastAuthError()
    if (authError) setError(authError)
  }, [])

  if (!authLoading && user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'criar') {
        if (!tipoConta) throw new Error('Escolha se a conta é pessoal, empresa ou as duas.')
        const fraca = senhaFraca(password)
        if (fraca) throw new Error(fraca)
        // O tipo é gravado no perfil logo após o primeiro acesso (tela de boas-vindas).
        sessionStorage.setItem(
          'jarvis_tipo_conta',
          JSON.stringify({ tipo: tipoConta, nome_empresa: tipoConta === 'pessoal' ? null : nomeEmpresa.trim() || null }),
        )
        await signUp({ email, password, name: name.trim() || undefined })
      } else {
        await signIn({ email, password })
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui concluir. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const handleForgot = async () => {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Informe o seu e-mail para receber o link de redefinição.')
      return
    }
    setBusy(true)
    try {
      await requestPasswordReset(email.trim(), window.location.origin + '/login')
      setNotice('Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui enviar o link. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetToken) return
    setError(null)
    setBusy(true)
    try {
      await resetPassword(resetToken, newPassword)
      const params = new URLSearchParams(window.location.search)
      params.delete('reset_token')
      const query = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''))
      setResetToken(null)
      setNewPassword('')
      setMode('entrar')
      setNotice('Senha atualizada. Entre com a nova senha.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui redefinir a senha. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const handleProvider = async (p: OAuthProvider) => {
    setError(null)
    setNotice(null)
    try {
      await signInWithProvider(p, { redirectTo: window.location.origin + '/login' })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui concluir o login. Tente de novo.')
    }
  }

  const oauthProviders = providers?.oauth ?? []
  const showPasswordForm = providers?.password === true

  return (
    <div className="min-h-screen bg-bg text-ink lg:grid lg:grid-cols-2">
      <aside className="hidden border-r border-line bg-surface px-10 py-16 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <Brand />
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink">
            Suas finanças, pessoais e da empresa, num só lugar.
          </h1>
          <ul className="mt-10 space-y-5">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-soft">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-soft">Jarvis, controle financeiro pessoal e empresarial.</p>
      </aside>

      <main className="flex min-h-screen flex-col px-6 py-10 lg:min-h-0 lg:justify-center lg:px-10 lg:py-16">
        <div className="mb-10 lg:hidden">
          <Brand />
        </div>

        <div className="mx-auto w-full max-w-sm">
          {resetToken ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">Definir nova senha</h2>
                <p className="mt-1 text-sm text-soft">Escolha uma senha nova para acessar o Jarvis.</p>
              </div>
              {error && <ErrorNote message={error} />}
              <Field label="Nova senha">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  {mode === 'entrar' ? 'Entrar' : 'Criar conta'}
                </h2>
                <p className="mt-1 text-sm text-soft">
                  {mode === 'entrar'
                    ? 'Acesse o seu painel financeiro.'
                    : 'Leva menos de um minuto para começar.'}
                </p>
              </div>

              {notice && (
                <div className="rounded-lg bg-income/10 px-3 py-2 text-sm text-income">{notice}</div>
              )}
              {error && <ErrorNote message={error} />}

              {providersLoading && (
                <p className="text-sm text-soft">Carregando formas de entrar...</p>
              )}

              {providersError && (
                <div className="space-y-3">
                  <ErrorNote message={providersError} />
                  <Button variant="ghost" onClick={loadProviders} className="w-full">
                    Tentar de novo
                  </Button>
                </div>
              )}

              {!providersLoading && !providersError && oauthProviders.length > 0 && (
                <div className="space-y-2">
                  {oauthProviders.map((p) => {
                    const dark = DARK_PROVIDERS.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => void handleProvider(p)}
                        className={
                          'flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
                          (dark
                            ? 'border-line bg-surface-2 text-ink hover:bg-surface'
                            : 'border-line bg-surface text-ink hover:bg-surface-2')
                        }
                      >
                        <img src={providerIcon(p, dark ? 'dark' : 'light')} alt="" width={18} height={18} />
                        Continuar com {providerLabel(p)}
                      </button>
                    )
                  })}
                </div>
              )}

              {!providersLoading && !providersError && oauthProviders.length > 0 && showPasswordForm && (
                <div className="flex items-center gap-3 text-xs text-soft">
                  <span className="h-px flex-1 bg-line" />
                  ou
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}

              {!providersLoading && !providersError && showPasswordForm && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'criar' && (
                    <div>
                      <span className="mb-1.5 block text-xs text-soft">Tipo de conta</span>
                      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de conta">
                        {TIPOS_CONTA.map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={tipoConta === value}
                            onClick={() => setTipoConta(value)}
                            className={
                              'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ' +
                              (tipoConta === value ? 'border-primary bg-primary/10 text-ink' : 'border-line text-soft hover:text-ink')
                            }
                          >
                            <Icon size={18} strokeWidth={1.75} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {mode === 'criar' && tipoConta && tipoConta !== 'pessoal' && (
                    <Field label="Nome da empresa (opcional)">
                      <input
                        className={inputClass}
                        type="text"
                        autoComplete="organization"
                        maxLength={120}
                        value={nomeEmpresa}
                        onChange={(e) => setNomeEmpresa(e.target.value)}
                        placeholder="Ex.: Moschen Serviços"
                      />
                    </Field>
                  )}
                  {mode === 'criar' && (
                    <Field label="Nome">
                      <input
                        className={inputClass}
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como devemos te chamar"
                      />
                    </Field>
                  )}
                  <Field label="E-mail">
                    <input
                      className={inputClass}
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                    />
                  </Field>
                  <Field label="Senha">
                    <input
                      className={inputClass}
                      type="password"
                      autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                    />
                  </Field>

                  {mode === 'entrar' && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleForgot()}
                        disabled={busy}
                        className="text-xs text-soft transition duration-200 hover:text-ink focus:outline-none focus-visible:underline"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Aguarde...' : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
                  </Button>
                </form>
              )}

              {!providersLoading && !providersError && showPasswordForm && (
                <p className="text-center text-sm text-soft">
                  {mode === 'entrar' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === 'entrar' ? 'criar' : 'entrar')
                      setError(null)
                      setNotice(null)
                    }}
                    className="font-medium text-primary transition duration-200 hover:brightness-110 focus:outline-none focus-visible:underline"
                  >
                    {mode === 'entrar' ? 'Criar conta' : 'Entrar'}
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
