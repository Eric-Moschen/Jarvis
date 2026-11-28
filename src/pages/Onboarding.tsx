import { useEffect, useRef, useState } from 'react'
import { Building2, Layers, Loader2, User } from 'lucide-react'
import { useFinance } from '../lib/FinanceContext'
import { signOut } from '../lib/1dollar-auth'
import type { TipoPerfil } from '../lib/types'
import { Button, ErrorNote, Field, cx, inputClass } from '../components/ui'

const CHAVE = 'jarvis_tipo_conta'

interface Opcao {
  tipo: TipoPerfil
  titulo: string
  texto: string
  Icone: typeof User
}

const OPCOES: Opcao[] = [
  {
    tipo: 'pessoal',
    titulo: 'Pessoal',
    texto: 'Contas da casa, cartões, metas e investimentos.',
    Icone: User,
  },
  {
    tipo: 'empresa',
    titulo: 'Empresa',
    texto: 'Fluxo de caixa, fornecedores, impostos e equipe.',
    Icone: Building2,
  },
  {
    tipo: 'ambos',
    titulo: 'Pessoal e empresa',
    texto: 'Tudo junto, com um filtro para separar.',
    Icone: Layers,
  },
]

const ehTipoValido = (v: unknown): v is TipoPerfil => v === 'pessoal' || v === 'empresa' || v === 'ambos'

interface Pendente {
  tipo: TipoPerfil
  nome_empresa: string | null
}

function lerPendente(): Pendente | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (!bruto) return null
    const dados = JSON.parse(bruto) as { tipo?: unknown; nome_empresa?: unknown }
    if (!ehTipoValido(dados.tipo)) return null
    const nome = typeof dados.nome_empresa === 'string' ? dados.nome_empresa.trim().slice(0, 120) : ''
    return { tipo: dados.tipo, nome_empresa: nome || null }
  } catch {
    return null
  }
}

export default function Onboarding() {
  const { savePerfil } = useFinance()
  const [pendente] = useState<Pendente | null>(() => lerPendente())
  const [tipo, setTipo] = useState<TipoPerfil | null>(null)
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const salvouRef = useRef(false)

  useEffect(() => {
    if (!pendente || salvouRef.current) return
    salvouRef.current = true
    let ativo = true
    setSalvando(true)
    savePerfil(pendente.tipo, pendente.nome_empresa)
      .then(() => {
        try {
          sessionStorage.removeItem(CHAVE)
        } catch {
          /* sem armazenamento */
        }
      })
      .catch((e: unknown) => {
        if (!ativo) return
        setErro(e instanceof Error ? e.message : 'Não consegui preparar sua conta. Tente de novo.')
        setTipo(pendente.tipo)
        setNomeEmpresa(pendente.nome_empresa ?? '')
        setSalvando(false)
      })
    return () => {
      ativo = false
    }
  }, [pendente, savePerfil])

  if (pendente && salvando && !erro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-bg px-4">
        <Loader2 className="animate-spin text-primary" size={28} />
        <p className="text-sm text-soft">Preparando sua conta...</p>
      </div>
    )
  }

  const precisaNome = tipo === 'empresa' || tipo === 'ambos'

  async function continuar() {
    if (!tipo || salvando) return
    setSalvando(true)
    setErro(null)
    try {
      await savePerfil(tipo, precisaNome ? nomeEmpresa : null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar. Tente de novo.')
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink tracking-tight">
          Como você vai usar o Jarvis?
        </h1>
        <p className="text-muted text-sm md:text-base mt-3">
          Isso define as categorias e como seus dados são organizados. Seus dados são privados: só você vê suas contas.
        </p>

        <div className="grid gap-3 md:grid-cols-3 mt-8">
          {OPCOES.map(({ tipo: valor, titulo, texto, Icone }) => {
            const ativo = tipo === valor
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setTipo(valor)}
                aria-pressed={ativo}
                className={cx(
                  'text-left rounded-card border bg-surface p-5 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  ativo ? 'border-primary ring-2 ring-primary/20' : 'border-line hover:border-soft/40',
                )}
              >
                <Icone size={22} className={ativo ? 'text-primary' : 'text-soft'} />
                <div className="font-display text-base font-semibold text-ink mt-3">{titulo}</div>
                <p className="text-sm text-soft mt-1">{texto}</p>
              </button>
            )
          })}
        </div>

        {precisaNome ? (
          <div className="mt-6">
            <Field label="Nome da empresa (opcional)">
              <input
                className={inputClass}
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Ateliê Norte Ltda"
              />
            </Field>
          </div>
        ) : null}

        {erro ? (
          <div className="mt-6">
            <ErrorNote message={erro} />
          </div>
        ) : null}

        <div className="mt-8">
          <Button className="w-full h-12 text-base" onClick={continuar} disabled={!tipo || salvando}>
            {salvando ? <Loader2 size={18} className="animate-spin" /> : null}
            Continuar
          </Button>
        </div>

        <div className="mt-6 text-sm">
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-soft hover:text-ink transition duration-200 rounded-lg px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
