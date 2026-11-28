// Conversa com o Jarvis: entende o pedido, executa as ações no sistema e guarda o histórico
// só na memória da aba (nada da conversa é salvo no banco nem no navegador).
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ai } from './1dollar-ai'
import { brl, fmtDate, gerarParcelas, monthLabel, todayISO } from './finance'
import { useFinance } from './FinanceContext'
import {
  contextoFinanceiro,
  EXEMPLOS,
  interpretarLocal,
  lerRespostaIA,
  promptSistema,
  ROTAS,
  type AcaoJarvis,
  type NomeRota,
} from './jarvis'
import type { Escopo } from './types'

export interface ResultadoAcao {
  id: string
  ok: boolean
  resumo: string
  /** Desfaz o cadastro feito por esta ação. */
  desfazer?: () => Promise<void>
  desfeito?: boolean
}

export interface MensagemJarvis {
  id: string
  autor: 'voce' | 'jarvis'
  texto: string
  resultados?: ResultadoAcao[]
  /** Mês (YYYY-MM) de um relatório para mostrar na conversa. */
  relatorio?: string
  /** Mostrar a lista de alertas de vencimento. */
  alertas?: boolean
  erro?: boolean
}

interface JarvisValue {
  mensagens: MensagemJarvis[]
  pensando: boolean
  enviar: (texto: string) => Promise<void>
  desfazer: (mensagemId: string, resultadoId: string) => Promise<void>
  limpar: () => void
  voz: boolean
  setVoz: (v: boolean) => void
  iaConfigurada: boolean | null
}

const JarvisContext = createContext<JarvisValue | null>(null)

const NOMES_ROTA: Record<NomeRota, string> = {
  painel: 'o painel',
  lancamentos: 'os lançamentos',
  contas: 'as contas',
  orcamento: 'orçamento e metas',
  cartoes: 'os cartões',
  investimentos: 'os investimentos',
  relatorios: 'os relatórios',
  alertas: 'alertas e sugestões',
  jarvis: 'a conversa com o Jarvis',
  configuracoes: 'as configurações da IA',
}

const BOAS_VINDAS: MensagemJarvis = {
  id: 'inicio',
  autor: 'jarvis',
  texto:
    'Olá, eu sou o Jarvis. Posso cadastrar contas e lançamentos, abrir qualquer tela, gerar relatórios e avisar o que está para vencer. Experimente: "Cadastrar conta de luz de 180 reais dia 10".',
}

const MAX_MENSAGENS = 80

export function JarvisProvider({ children }: { children: ReactNode }) {
  const fin = useFinance()
  const navigate = useNavigate()
  const [mensagens, setMensagens] = useState<MensagemJarvis[]>([BOAS_VINDAS])
  const [pensando, setPensando] = useState(false)
  const [voz, setVoz] = useState(false)
  const [iaConfigurada, setIaConfigurada] = useState<boolean | null>(null)
  const finRef = useRef(fin)
  finRef.current = fin
  const historicoRef = useRef<MensagemJarvis[]>([BOAS_VINDAS])
  historicoRef.current = mensagens

  const falar = useCallback(
    (texto: string) => {
      if (!voz || typeof window === 'undefined' || !('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(texto.slice(0, 600))
      u.lang = 'pt-BR'
      window.speechSynthesis.speak(u)
    },
    [voz],
  )

  const statusIA = useCallback(async () => {
    if (iaConfigurada !== null) return iaConfigurada
    try {
      const s = await ai.status()
      setIaConfigurada(s.configured)
      return s.configured
    } catch {
      setIaConfigurada(false)
      return false
    }
  }, [iaConfigurada])

  /** Escopo dos novos cadastros: o travado pelo tipo de conta, o pedido, o filtro atual ou pessoal. */
  const escopoDe = (pedido?: Escopo): Escopo => {
    const f = finRef.current
    return f.escopoFixo ?? pedido ?? (f.escopo === 'todos' ? 'pessoal' : f.escopo)
  }

  const executar = useCallback(
    async (acoes: AcaoJarvis[]): Promise<{ resultados: ResultadoAcao[]; relatorio?: string; alertas?: boolean }> => {
      const f = finRef.current
      const resultados: ResultadoAcao[] = []
      let relatorio: string | undefined
      let alertas = false
      for (const a of acoes) {
        const id = crypto.randomUUID()
        try {
          if (a.tipo === 'navegar') {
            navigate(ROTAS[a.rota])
            resultados.push({ id, ok: true, resumo: `Abri ${NOMES_ROTA[a.rota]}.` })
          } else if (a.tipo === 'relatorio') {
            relatorio = a.mes
          } else if (a.tipo === 'alertas') {
            alertas = true
          } else if (a.tipo === 'criar_conta') {
            const c = a.conta
            const grupo = crypto.randomUUID()
            const parcelas = gerarParcelas(c.valor, c.parcelas, c.vencimento, c.modo === 'repetir' ? 'parcela' : 'total')
            await f.addContas(
              parcelas.map((p) => ({
                tipo: c.tipo,
                descricao: c.descricao,
                valor: p.valor,
                vencimento: p.data,
                categoria: c.categoria,
                escopo: escopoDe(c.escopo),
                status: 'pendente' as const,
                pago_em: null,
                grupo_parcela: grupo,
                parcela_num: p.num,
                parcelas_total: p.total,
              })),
            )
            const quando = parcelas.length > 1
              ? `${parcelas.length} ${c.modo === 'repetir' ? 'meses' : 'parcelas'} de ${brl(parcelas[parcelas.length - 1].valor)} a partir de ${fmtDate(c.vencimento)}`
              : `${brl(c.valor)}, vence ${fmtDate(c.vencimento)}`
            resultados.push({
              id,
              ok: true,
              resumo: `Conta a ${c.tipo === 'pagar' ? 'pagar' : 'receber'} cadastrada: ${c.descricao}, ${quando} (${c.categoria}).`,
              desfazer: () => finRef.current.removeGrupoContas(grupo),
            })
          } else if (a.tipo === 'criar_lancamento') {
            const l = a.lancamento
            const nomeCartao = l.cartao?.toLowerCase()
            const cartao = nomeCartao && l.tipo === 'despesa' ? f.all.cartoes.find((c) => c.nome.toLowerCase().includes(nomeCartao)) : undefined
            const grupo = crypto.randomUUID()
            const parcelas = gerarParcelas(l.valor, l.parcelas, l.data, 'total')
            await f.addTransacoes(
              parcelas.map((p) => ({
                tipo: l.tipo,
                descricao: l.descricao,
                valor: p.valor,
                data: p.data,
                categoria: l.categoria,
                escopo: cartao ? cartao.escopo : escopoDe(l.escopo),
                cartao_id: cartao ? cartao.id : null,
                grupo_parcela: grupo,
                parcela_num: p.num,
                parcelas_total: p.total,
              })),
            )
            const quanto = parcelas.length > 1 ? `${parcelas.length}x de ${brl(parcelas[parcelas.length - 1].valor)}` : brl(l.valor)
            resultados.push({
              id,
              ok: true,
              resumo: `${l.tipo === 'receita' ? 'Receita' : 'Despesa'} lançada: ${l.descricao}, ${quanto} em ${fmtDate(l.data)}${cartao ? ` no ${cartao.nome}` : ''} (${l.categoria}).`,
              desfazer: () => finRef.current.removeGrupoTransacoes(grupo),
            })
          }
        } catch (err) {
          resultados.push({ id, ok: false, resumo: err instanceof Error ? err.message : 'Não consegui concluir esta ação.' })
        }
      }
      return { resultados, relatorio, alertas }
    },
    // escopoDe lê do ref; navigate é estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  )

  const enviar = useCallback(
    async (textoBruto: string) => {
      const texto = textoBruto.trim().slice(0, 2000)
      if (!texto || pensando) return
      const minha: MensagemJarvis = { id: crypto.randomUUID(), autor: 'voce', texto }
      setMensagens((m) => [...m, minha].slice(-MAX_MENSAGENS))
      setPensando(true)
      const hoje = todayISO()
      let resposta = ''
      let acoes: AcaoJarvis[] = []
      let erro = false
      try {
        const local = interpretarLocal(texto, hoje)
        if (local?.simples) {
          acoes = local.acoes
        } else if (await statusIA()) {
          try {
            const f = finRef.current
            const escopos = f.escopoFixo ? `somente ${f.escopoFixo}` : 'pessoal e empresa'
            const historico = historicoRef.current
              .filter((m) => m.id !== 'inicio')
              .slice(-10)
              .map((m) => ({ role: m.autor === 'voce' ? ('user' as const) : ('assistant' as const), content: m.texto.slice(0, 1500) }))
            const { text } = await ai.text({
              json: true,
              maxTokens: 900,
              messages: [
                { role: 'system', content: promptSistema(hoje, escopos, contextoFinanceiro(f.view, hoje, f.perfil?.nome_empresa)) },
                ...historico,
                { role: 'user', content: texto },
              ],
            })
            const r = lerRespostaIA(text, hoje)
            resposta = r.resposta
            acoes = r.acoes
          } catch (err) {
            if (local) acoes = local.acoes
            else throw err
          }
        } else if (local) {
          acoes = local.acoes
        } else {
          resposta = `Para conversar livremente eu preciso da IA ligada (menu Configurar IA). Sem ela, eu entendo comandos diretos, por exemplo: ${EXEMPLOS.slice(0, 4)
            .map((e) => `"${e}"`)
            .join(', ')}.`
        }

        const { resultados, relatorio, alertas } = await executar(acoes)
        if (!resposta) {
          if (relatorio) resposta = `Aqui está o relatório de ${monthLabel(relatorio)}.`
          else if (alertas) resposta = 'Estes são os vencimentos que pedem atenção:'
          else if (resultados.length) resposta = resultados.every((r) => r.ok) ? 'Pronto.' : 'Tive um problema em parte do pedido.'
          else resposta = 'Não entendi. Pode reformular?'
        }
        const msg: MensagemJarvis = { id: crypto.randomUUID(), autor: 'jarvis', texto: resposta, resultados, relatorio, alertas }
        setMensagens((m) => [...m, msg].slice(-MAX_MENSAGENS))
        falar([resposta, ...resultados.map((r) => r.resumo)].join(' '))
      } catch (err) {
        erro = true
        const texto = err instanceof Error ? err.message : 'Não consegui responder agora.'
        setMensagens((m) => [...m, { id: crypto.randomUUID(), autor: 'jarvis' as const, texto, erro }].slice(-MAX_MENSAGENS))
      } finally {
        setPensando(false)
      }
    },
    [pensando, statusIA, executar, falar],
  )

  const desfazer = useCallback(async (mensagemId: string, resultadoId: string) => {
    const msg = historicoRef.current.find((m) => m.id === mensagemId)
    const r = msg?.resultados?.find((x) => x.id === resultadoId)
    if (!r?.desfazer || r.desfeito) return
    await r.desfazer()
    setMensagens((ms) =>
      ms.map((m) =>
        m.id !== mensagemId ? m : { ...m, resultados: m.resultados?.map((x) => (x.id === resultadoId ? { ...x, desfeito: true } : x)) },
      ),
    )
  }, [])

  const limpar = useCallback(() => setMensagens([BOAS_VINDAS]), [])

  const value = useMemo(
    () => ({ mensagens, pensando, enviar, desfazer, limpar, voz, setVoz, iaConfigurada }),
    [mensagens, pensando, enviar, desfazer, limpar, voz, iaConfigurada],
  )
  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>
}

export function useJarvis(): JarvisValue {
  const ctx = useContext(JarvisContext)
  if (!ctx) throw new Error('useJarvis precisa estar dentro de JarvisProvider')
  return ctx
}
