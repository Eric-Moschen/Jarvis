export type Escopo = 'pessoal' | 'empresa'
export type EscopoFiltro = 'todos' | Escopo

/** Tipo de conta escolhido no cadastro. 'ambos' mantém pessoal e empresa separados no mesmo login. */
export type TipoPerfil = 'pessoal' | 'empresa' | 'ambos'

export interface Perfil {
  tipo: TipoPerfil
  nome_empresa: string | null
}

export interface Transacao {
  id: string
  tipo: 'receita' | 'despesa'
  descricao: string
  valor: number
  data: string // YYYY-MM-DD
  categoria: string
  escopo: Escopo
  cartao_id: string | null
  /** Caminho do comprovante no Storage privado. */
  comprovante_path?: string | null
  /** Parcelamento: todas as parcelas da mesma compra têm o mesmo grupo. */
  grupo_parcela?: string | null
  parcela_num?: number | null
  parcelas_total?: number | null
}

export interface Conta {
  id: string
  tipo: 'pagar' | 'receber'
  descricao: string
  valor: number
  vencimento: string // YYYY-MM-DD
  categoria: string
  escopo: Escopo
  status: 'pendente' | 'pago'
  pago_em: string | null
  /** Caminho do comprovante no Storage privado. */
  comprovante_path?: string | null
  /** Parcelamento ou repetição: todas as contas da série têm o mesmo grupo. */
  grupo_parcela?: string | null
  parcela_num?: number | null
  parcelas_total?: number | null
}

export interface Cartao {
  id: string
  nome: string
  limite: number
  dia_fechamento: number
  dia_vencimento: number
  escopo: Escopo
}

export interface Orcamento {
  id: string
  categoria: string
  limite: number
  escopo: Escopo
}

export interface Meta {
  id: string
  nome: string
  valor_alvo: number
  valor_atual: number
  prazo: string | null
  escopo: Escopo
}

export interface Investimento {
  id: string
  nome: string
  tipo: string
  valor_investido: number
  valor_atual: number
  data: string
  escopo: Escopo
}

export const CATEGORIAS_DESPESA = [
  'Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação',
  'Assinaturas', 'Impostos', 'Fornecedores', 'Folha e equipe', 'Marketing', 'Outros',
]
export const CATEGORIAS_RECEITA = ['Salário', 'Vendas', 'Serviços', 'Pró-labore', 'Rendimentos', 'Reembolso', 'Outros']
export const TIPOS_INVESTIMENTO = ['Renda fixa', 'Ações', 'Fundos imobiliários', 'Cripto', 'Reserva de emergência', 'Outros']
