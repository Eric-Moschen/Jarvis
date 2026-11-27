import { useEffect, useMemo, useState } from 'react'
import { useFinance } from '../lib/FinanceContext'
import { brl, fmtDate, gerarParcelas, todayISO } from '../lib/finance'
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, type Escopo, type Transacao } from '../lib/types'
import { Button, ErrorNote, Field, Modal, Segmented, inputClass } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  initial?: Transacao
}

type Tipo = 'despesa' | 'receita'
type Forma = 'avista' | 'parcelado'
type Modo = 'total' | 'parcela'

export function TransacaoModal({ open, onClose, initial }: Props) {
  const { all, escopo, addTransacao, addTransacoes, updateTransacao } = useFinance()

  const [tipo, setTipo] = useState<Tipo>('despesa')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(todayISO())
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0])
  const [escopoSel, setEscopoSel] = useState<Escopo>('pessoal')
  const [cartaoId, setCartaoId] = useState<string>('')
  const [forma, setForma] = useState<Forma>('avista')
  const [numParcelas, setNumParcelas] = useState('2')
  const [modo, setModo] = useState<Modo>('total')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setForma('avista')
    setNumParcelas('2')
    setModo('total')
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
  const parcelado = !initial && forma === 'parcelado'
  const nParcelas = Math.round(Number(numParcelas))
  const nValido = Number.isFinite(nParcelas) && nParcelas >= 2 && nParcelas <= 120

  const preview = useMemo(() => {
    if (!parcelado || !nValido) return null
    const num = Number(valor)
    if (!valor.trim() || !Number.isFinite(num) || num <= 0 || !data) return null
    try {
      const parcelas = gerarParcelas(num, nParcelas, data, modo)
      const primeiro = parcelas[0]
      const iguais = parcelas.every((p) => p.valor === primeiro.valor)
      const total = parcelas.reduce((acc, p) => acc + p.valor, 0)
      const ultimo = parcelas[parcelas.length - 1]
      return {
        valores: iguais
          ? `${nParcelas}x de ${brl(primeiro.valor)}`
          : `1ª de ${brl(primeiro.valor)} e demais de ${brl(parcelas[1].valor)}`,
        total: `Total ${brl(total)}`,
        periodo: `De ${fmtDate(primeiro.data)} a ${fmtDate(ultimo.data)}`,
      }
    } catch {
      return null
    }
  }, [parcelado, nValido, valor, nParcelas, data, modo])

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
    const cartaoFinal = mostrarCartao && cartaoId ? cartaoId : null

    if (initial) {
      const payload = {
        tipo,
        descricao: descricao.trim(),
        valor: Math.round(num * 100) / 100,
        data,
        categoria,
        escopo: escopoSel,
        cartao_id: cartaoFinal,
      }
      setSaving(true)
      try {
        await updateTransacao(initial.id, payload)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não consegui salvar o lançamento.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (forma === 'avista') {
      const payload = {
        tipo,
        descricao: descricao.trim(),
        valor: Math.round(num * 100) / 100,
        data,
        categoria,
        escopo: escopoSel,
        cartao_id: cartaoFinal,
        grupo_parcela: null,
        parcela_num: null,
        parcelas_total: null,
      }
      setSaving(true)
      try {
        await addTransacao(payload)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não consegui salvar o lançamento.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!nValido) {
      setError('Informe de 2 a 120 parcelas.')
      return
    }

    setSaving(true)
    try {
      const parcelas = gerarParcelas(num, nParcelas, data, modo)
      const grupo = crypto.randomUUID()
      await addTransacoes(
        parcelas.map((p) => ({
          tipo,
          descricao: descricao.trim(),
          valor: p.valor,
          data: p.data,
          categoria,
          escopo: escopoSel,
          cartao_id: cartaoFinal,
          grupo_parcela: grupo,
          parcela_num: p.num,
          parcelas_total: p.total,
        })),
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o lançamento.')
    } finally {
      setSaving(false)
    }
  }

  const ehParcela = !!initial && (initial.parcelas_total ?? 0) > 1
  const rotuloSalvar = saving
    ? 'Salvando...'
    : parcelado && nValido
      ? `Salvar ${nParcelas} parcelas`
      : 'Salvar'

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar lançamento' : 'Novo lançamento'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {ehParcela && initial ? (
          <p className="text-xs text-soft">
            Parcela {initial.parcela_num} de {initial.parcelas_total}. A edição muda só esta parcela.
          </p>
        ) : null}

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
          <Field label={parcelado ? 'Data da 1ª parcela' : 'Data'}>
            <input
              className={inputClass}
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Field>
        </div>

        {!initial && (
          <Field label="Forma">
            <Segmented
              options={[
                { value: 'avista', label: 'À vista' },
                { value: 'parcelado', label: 'Parcelado' },
              ]}
              value={forma}
              onChange={(v) => setForma(v as Forma)}
            />
          </Field>
        )}

        {parcelado && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Número de parcelas">
                <input
                  className={inputClass + ' tabular'}
                  type="number"
                  min="2"
                  max="120"
                  step="1"
                  inputMode="numeric"
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(e.target.value)}
                />
              </Field>
              <Field label="O valor informado é">
                <Segmented
                  options={[
                    { value: 'total', label: 'Total' },
                    { value: 'parcela', label: 'Cada parcela' },
                  ]}
                  value={modo}
                  onChange={(v) => setModo(v as Modo)}
                />
              </Field>
            </div>

            {preview && (
              <div className="rounded-xl border border-line p-3 text-sm text-soft">
                <div className="tabular">{preview.valores}</div>
                <div className="tabular">{preview.total}</div>
                <div className="tabular">{preview.periodo}</div>
                {cartaoId ? <div className="mt-1">Cada parcela entra na fatura do mês correspondente.</div> : null}
              </div>
            )}
          </>
        )}

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
            {rotuloSalvar}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
