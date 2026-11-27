import { useEffect, useState } from 'react'
import { useFinance } from '../lib/FinanceContext'
import { todayISO } from '../lib/finance'
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, type Escopo, type Transacao } from '../lib/types'
import { Button, ErrorNote, Field, Modal, Segmented, inputClass } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Transacao
}

type Tipo = 'despesa' | 'receita'

export function TransacaoModal({ open, onClose, initial }: Props) {
  const { all, escopo, addTransacao, updateTransacao } = useFinance()

  const [tipo, setTipo] = useState<Tipo>('despesa')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(todayISO())
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0])
  const [escopoSel, setEscopoSel] = useState<Escopo>('pessoal')
  const [cartaoId, setCartaoId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    if (initial) {
      setTipo(initial.tipo)
      setDescricao(initial.descricao)
      setValor(String(initial.valor))
      setData(initial.data.slice(0, 10))
      setCategoria(initial.categoria)
      setEscopoSel(initial.escopo)
      setCartaoId(initial.cartao_id ?? '')
    } else {
      setTipo('despesa')
      setDescricao('')
      setValor('')
      setData(todayISO())
      setCategoria(CATEGORIAS_DESPESA[0])
      setEscopoSel(escopo === 'todos' ? 'pessoal' : escopo)
      setCartaoId('')
    }
  }, [open, initial, escopo])

  const categorias = tipo === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA
  const cartoesDoEscopo = all.cartoes.filter((c) => c.escopo === escopoSel)
  const mostrarCartao = tipo === 'despesa' && cartoesDoEscopo.length > 0

  function changeTipo(next: Tipo) {
    setTipo(next)
    const lista = next === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA
    if (!lista.includes(categoria)) setCategoria(lista[0])
    if (next === 'receita') setCartaoId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const num = Number(valor)
    if (!descricao.trim()) {
      setError('Descreva o lançamento.')
      return
    }
    if (!valor.trim() || !Number.isFinite(num) || num <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    if (!data) {
      setError('Escolha uma data.')
      return
    }
    const payload = {
      tipo,
      descricao: descricao.trim(),
      valor: Math.round(num * 100) / 100,
      data,
      categoria,
      escopo: escopoSel,
      cartao_id: mostrarCartao && cartaoId ? cartaoId : null,
    }
    setSaving(true)
    try {
      if (initial) await updateTransacao(initial.id, payload)
      else await addTransacao(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o lançamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar lançamento' : 'Novo lançamento'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tipo">
          <Segmented
            options={[
              { value: 'despesa', label: 'Despesa' },
              { value: 'receita', label: 'Receita' },
            ]}
            value={tipo}
            onChange={(v) => changeTipo(v as Tipo)}
          />
        </Field>

        <Field label="Descrição">
          <input
            className={inputClass}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Mercado do mês"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor">
            <input
              className={inputClass + ' tabular'}
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <Field label="Data">
            <input
              className={inputClass}
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Categoria">
          <select className={inputClass} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Escopo">
          <Segmented
            options={[
              { value: 'pessoal', label: 'Pessoal' },
              { value: 'empresa', label: 'Empresa' },
            ]}
            value={escopoSel}
            onChange={(v) => {
              setEscopoSel(v as Escopo)
              setCartaoId('')
            }}
          />
        </Field>

        {mostrarCartao && (
          <Field label="Cartão" hint="Opcional">
            <select className={inputClass} value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
              <option value="">Sem cartão</option>
              {cartoesDoEscopo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
