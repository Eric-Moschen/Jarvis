import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BellRing, Lightbulb, ThumbsUp, CheckCircle2 } from 'lucide-react'
import { useFinance } from '../lib/FinanceContext'
import { useJarvis } from '../lib/JarvisContext'
import { alertasVencimento, sugestoes, type Alerta, type Sugestao } from '../lib/insights'
import { brl, fmtDate, todayISO } from '../lib/finance'
import { Button, Card, EmptyState, ErrorNote, PageHeader, cx } from '../components/ui'

type Permissao = 'idle' | 'granted' | 'denied'

const nivelCor: Record<Alerta['nivel'], string> = {
  atrasada: 'text-expense',
  hoje: 'text-warn',
  em_breve: 'text-soft',
}

const nivelTitulo: Record<Alerta['nivel'], string> = {
  atrasada: 'Atrasadas',
  hoje: 'Vencem hoje',
  em_breve: 'Próximos dias',
}

function contaIdDoAlerta(alerta: Alerta): string | null {
  return alerta.id.startsWith('conta-') ? alerta.id.slice('conta-'.length) : null
}

function iconeSugestao(tipo: Sugestao['tipo']) {
  if (tipo === 'atencao') return <AlertTriangle size={18} className="text-warn" />
  if (tipo === 'oportunidade') return <Lightbulb size={18} className="text-primary" />
  return <ThumbsUp size={18} className="text-income" />
}

export default function Alertas() {
  const { view, pagarConta } = useFinance()
  const { enviar } = useJarvis()
  const navigate = useNavigate()

  const hoje = todayISO()
  const alertas = alertasVencimento(view, hoje, 15)
  const listaSugestoes = sugestoes(view, hoje)

  const [permissao, setPermissao] = useState<Permissao>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'idle'
    return Notification.permission === 'granted' ? 'granted' : 'idle'
  })
  const [pedindoPermissao, setPedindoPermissao] = useState(false)

  const [pagando, setPagando] = useState<string | null>(null)
  const [erroItem, setErroItem] = useState<Record<string, string>>({})

  const suportaNotificacao = typeof window !== 'undefined' && 'Notification' in window

  async function ativarAvisos() {
    if (!suportaNotificacao) return
    setPedindoPermissao(true)
    try {
      const resultado = await Notification.requestPermission()
      setPermissao(resultado === 'granted' ? 'granted' : 'denied')
    } catch {
      setPermissao('denied')
    } finally {
      setPedindoPermissao(false)
    }
  }

  async function marcarPaga(alerta: Alerta) {
    const contaId = contaIdDoAlerta(alerta)
    if (!contaId) return
    const conta = view.contas.find((c) => c.id === contaId)
    if (!conta) {
      setErroItem((s) => ({ ...s, [alerta.id]: 'Conta não encontrada. Atualize a página.' }))
      return
    }
    setPagando(alerta.id)
    setErroItem((s) => {
      const copia = { ...s }
      delete copia[alerta.id]
      return copia
    })
    try {
      await pagarConta(conta.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não consegui marcar como paga. Tente de novo.'
      setErroItem((s) => ({ ...s, [alerta.id]: msg }))
    } finally {
      setPagando(null)
    }
  }

  async function pedirAnalise() {
    await enviar('Analise meus últimos 3 meses e me dê 3 sugestões práticas para melhorar minha gestão financeira')
    navigate('/assistente')
  }

  const grupos: Alerta['nivel'][] = ['atrasada', 'hoje', 'em_breve']

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
      <PageHeader
        title="Alertas e sugestões"
        subtitle="O que vence nos próximos 15 dias e onde dá para melhorar, com base nos meses anteriores."
        action={
          suportaNotificacao && permissao !== 'granted' ? (
            <Button variant="ghost" onClick={ativarAvisos} disabled={pedindoPermissao}>
              <BellRing size={16} />
              {pedindoPermissao ? 'Pedindo permissão...' : 'Ativar avisos no navegador'}
            </Button>
          ) : null
        }
      />

      {permissao === 'granted' ? (
        <p className="text-sm text-income mb-6">Avisos ativados</p>
      ) : permissao === 'denied' ? (
        <p className="text-sm text-expense mb-6">Permissão negada no navegador</p>
      ) : null}

      <section className="mb-12">
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Vencimentos</h2>

        {alertas.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={28} />}
            title="Tudo em dia"
            text="Nenhuma conta ou fatura vencendo nos próximos 15 dias."
          />
        ) : (
          <div className="flex flex-col gap-8">
            {grupos.map((nivel) => {
              const itens = alertas.filter((a) => a.nivel === nivel)
              if (itens.length === 0) return null
              const total = itens.reduce((acc, a) => acc + a.valor, 0)
              return (
                <div key={nivel}>
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <h3 className={cx('text-sm font-medium', nivelCor[nivel])}>
                      {nivelTitulo[nivel]}
                      <span className="text-soft font-normal"> · {itens.length}</span>
                    </h3>
                    <span className="text-sm text-soft tabular">{brl(total)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {itens.map((alerta) => {
                      const contaId = contaIdDoAlerta(alerta)
                      const erro = erroItem[alerta.id]
                      return (
                        <Card key={alerta.id} className="p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink truncate">{alerta.titulo}</div>
                              <div className="text-sm text-muted">{alerta.detalhe}</div>
                            </div>
                            <div className="flex items-center gap-3 sm:shrink-0">
                              <span className="tabular text-sm text-ink">{brl(alerta.valor)}</span>
                              {contaId ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => marcarPaga(alerta)}
                                  disabled={pagando === alerta.id}
                                >
                                  {pagando === alerta.id ? 'Salvando...' : 'Marcar como paga'}
                                </Button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => navigate(alerta.rota)}
                                  className="text-sm text-primary hover:underline transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                                >
                                  Abrir
                                </button>
                              )}
                            </div>
                          </div>
                          {erro ? <div className="mt-3"><ErrorNote message={erro} /></div> : null}
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink mb-4">Sugestões para sua gestão</h2>

        {listaSugestoes.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={28} />}
            title="Sem sugestões por agora"
            text="Assim que houver mais movimentações, o Jarvis aponta oportunidades de melhoria."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {listaSugestoes.map((s) => (
              <Card key={s.id} className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{iconeSugestao(s.tipo)}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{s.titulo}</div>
                    <p className="text-sm text-muted mt-1">{s.texto}</p>
                  </div>
                </div>
                {s.rota ? (
                  <button
                    type="button"
                    onClick={() => navigate(s.rota as string)}
                    className="self-start text-sm text-primary hover:underline transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                  >
                    Ver detalhes
                  </button>
                ) : null}
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">Quer uma análise mais profunda?</p>
          <Button onClick={pedirAnalise}>Pedir análise ao Jarvis</Button>
        </Card>
      </section>
    </div>
  )
}
