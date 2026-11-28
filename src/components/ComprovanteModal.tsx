import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileUp } from 'lucide-react'
import { Button, Card, ErrorNote, Field, Modal, ProgressBar, Segmented, cx, inputClass } from './ui'
import { useFinance } from '../lib/FinanceContext'
import { ai } from '../lib/1dollar-ai'
import { storage } from '../lib/1dollar-storage'
import { contaCorrespondente, extrairTexto, interpretarComprovante, refinarComIA, type DadosComprovante } from '../lib/comprovante'
import { brl, fmtDate, todayISO } from '../lib/finance'
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, type Escopo } from '../lib/types'

type Etapa = 'entrada' | 'processando' | 'conferencia' | 'salvo'

interface Formulario {
  tipo: 'despesa' | 'receita'
  descricao: string
  valor: string
  data: string
  categoria: string
  escopo: Escopo
}

const ACCEPT = 'image/*,application/pdf,text/plain'

function parseValor(s: string): number {
  const limpo = s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

function formFromDados(d: DadosComprovante, escopoPadrao: Escopo): Formulario {
  return {
    tipo: d.tipo,
    descricao: d.descricao,
    valor: d.valor != null ? d.valor.toFixed(2).replace('.', ',') : '',
    data: d.data ?? todayISO(),
    categoria: d.categoria,
    escopo: escopoPadrao,
  }
}

export default function ComprovanteModal({
  open,
  onClose,
  arquivoInicial,
}: {
  open: boolean
  onClose: () => void
  arquivoInicial?: File | null
}) {
  const { view, escopo, escopoFixo, addTransacao, pagarConta, updateConta } = useFinance()
  const [etapa, setEtapa] = useState<Etapa>('entrada')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [textoColado, setTextoColado] = useState('')
  const [mostrarTexto, setMostrarTexto] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [lendoIA, setLendoIA] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosComprovante | null>(null)
  const [form, setForm] = useState<Formulario>({ tipo: 'despesa', descricao: '', valor: '', data: todayISO(), categoria: 'Outros', escopo: 'pessoal' })
  const [marcarConta, setMarcarConta] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [miniatura, setMiniatura] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const processandoRef = useRef(false)

  const escopoPadrao: Escopo = escopoFixo ?? (escopo === 'todos' ? 'pessoal' : escopo)

  const resetar = useCallback(() => {
    setEtapa('entrada')
    setArquivo(null)
    setTextoColado('')
    setMostrarTexto(false)
    setProgresso(0)
    setLendoIA(false)
    setErro(null)
    setDados(null)
    setMarcarConta(true)
    setSalvando(false)
    setErroSalvar(null)
    setMiniatura(null)
    processandoRef.current = false
  }, [])

  const fechar = useCallback(() => {
    resetar()
    onClose()
  }, [onClose, resetar])

  useEffect(() => {
    if (!open) resetar()
  }, [open, resetar])

  useEffect(() => {
    if (!arquivo || !arquivo.type.startsWith('image/')) {
      setMiniatura(null)
      return
    }
    const url = URL.createObjectURL(arquivo)
    setMiniatura(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const processar = useCallback(
    async (file: File | null, texto: string | null) => {
      if (processandoRef.current) return
      processandoRef.current = true
      setErro(null)
      setEtapa('processando')
      setProgresso(0)
      setLendoIA(false)
      try {
        let textoFinal = texto ?? ''
        if (file) {
          textoFinal = await extrairTexto(file, (p) => setProgresso(Math.round(p * 100)))
        }
        if (!textoFinal.trim()) throw new Error('Não encontrei texto no comprovante. Tente outra foto ou cole o texto.')
        const base = interpretarComprovante(textoFinal)
        let configurada = false
        try {
          const st = await ai.status()
          configurada = st.configured
        } catch {
          configurada = false
        }
        let final = base
        if (configurada) {
          setLendoIA(true)
          final = await refinarComIA(textoFinal, base)
        }
        setDados(final)
        setForm(formFromDados(final, escopoPadrao))
        setMarcarConta(true)
        setEtapa('conferencia')
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não consegui ler o comprovante.')
        setEtapa('entrada')
      } finally {
        processandoRef.current = false
      }
    },
    [escopoPadrao],
  )

  useEffect(() => {
    if (open && arquivoInicial && etapa === 'entrada' && !processandoRef.current) {
      setArquivo(arquivoInicial)
      void processar(arquivoInicial, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, arquivoInicial])

  const escolherArquivo = (file: File | null) => {
    if (!file) return
    setArquivo(file)
    void processar(file, null)
  }

  const aoColar = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file')
    if (item) {
      const file = item.getAsFile()
      if (file) {
        e.preventDefault()
        escolherArquivo(file)
        return
      }
    }
    const texto = e.clipboardData.getData('text/plain')
    if (texto.trim()) {
      e.preventDefault()
      setTextoColado(texto)
      void processar(null, texto)
    }
  }

  const aoSoltar = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) escolherArquivo(file)
  }

  const lerTexto = () => {
    if (!textoColado.trim()) {
      setErro('Cole o texto do comprovante antes de continuar.')
      return
    }
    void processar(null, textoColado)
  }

  const valorNum = parseValor(form.valor)

  const conta = useMemo(() => {
    if (!dados) return null
    return contaCorrespondente(view.contas, { ...dados, tipo: form.tipo, valor: valorNum > 0 ? valorNum : null })
  }, [dados, form.tipo, valorNum, view.contas])

  const categorias = form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA
  const listaCategorias: string[] = (categorias as readonly string[]).includes(form.categoria)
    ? [...categorias]
    : [form.categoria, ...categorias]

  const salvar = async () => {
    setErroSalvar(null)
    if (!(valorNum > 0)) {
      setErroSalvar('Informe um valor maior que zero.')
      return
    }
    if (!form.data) {
      setErroSalvar('Escolha a data do comprovante.')
      return
    }
    setSalvando(true)
    try {
      let path: string | null = null
      if (arquivo) {
        const up = await storage.upload(arquivo, { private: true })
        path = up.path
      }
      if (conta && marcarConta) {
        await pagarConta(conta.id)
        if (path) await updateConta(conta.id, { comprovante_path: path })
      } else {
        await addTransacao({
          tipo: form.tipo,
          descricao: form.descricao.trim() || 'Comprovante',
          valor: valorNum,
          data: form.data,
          categoria: form.categoria,
          escopo: form.escopo,
          cartao_id: null,
          grupo_parcela: null,
          parcela_num: null,
          parcelas_total: null,
          comprovante_path: path,
        })
      }
      ;(window as unknown as { onedollar?: { track?: (e: string) => void } }).onedollar?.track?.('comprovante_importado')
      setEtapa('salvo')
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não consegui salvar o comprovante.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={fechar} title="Importar comprovante">
      <div onPaste={aoColar}>
        {etapa === 'entrada' ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={aoSoltar}
              className="border-2 border-dashed border-line rounded-2xl p-8 text-center flex flex-col items-center gap-3"
            >
              <FileUp size={28} className="text-soft" />
              <div>
                <p className="text-sm text-ink">Cole (Ctrl+V), arraste ou escolha o comprovante</p>
                <p className="text-sm text-muted mt-1">Imagem (JPG, PNG), PDF ou texto. Pix, boleto, transferência ou recibo.</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()}>
                Escolher arquivo
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
              />
            </div>

            {erro ? <ErrorNote message={erro} /> : null}

            {mostrarTexto ? (
              <div className="space-y-2">
                <textarea
                  value={textoColado}
                  onChange={(e) => setTextoColado(e.target.value)}
                  rows={6}
                  className={inputClass}
                  placeholder="Cole aqui o texto do comprovante"
                />
                <Button type="button" onClick={lerTexto}>
                  Ler texto
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarTexto(true)}
                className="text-sm text-primary hover:underline transition duration-200"
              >
                Prefiro colar o texto do comprovante
              </button>
            )}
          </div>
        ) : null}

        {etapa === 'processando' ? (
          <div className="space-y-4">
            {miniatura ? (
              <img src={miniatura} alt="Prévia do comprovante enviado" className="max-h-40 rounded-lg border border-line object-contain" />
            ) : null}
            {arquivo ? <p className="text-sm text-soft truncate">{arquivo.name}</p> : null}
            <ProgressBar value={lendoIA ? 100 : progresso} />
            <p className="text-sm text-muted">{lendoIA ? 'Conferindo com a IA...' : 'Lendo o comprovante...'}</p>
          </div>
        ) : null}

        {etapa === 'conferencia' && dados ? (
          <div className="space-y-4">
            {miniatura ? (
              <img src={miniatura} alt="Prévia do comprovante enviado" className="max-h-40 rounded-lg border border-line object-contain" />
            ) : null}

            <Field label="Tipo">
              <Segmented
                options={[
                  { value: 'despesa', label: 'Despesa' },
                  { value: 'receita', label: 'Receita' },
                ]}
                value={form.tipo}
                onChange={(v) => setForm((f) => ({ ...f, tipo: v === 'receita' ? 'receita' : 'despesa', categoria: 'Outros' }))}
              />
            </Field>

            <Field label="Descrição">
              <input
                className={inputClass}
                value={form.descricao}
                maxLength={200}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Valor (R$)">
                <input
                  className={cx(inputClass, 'tabular')}
                  inputMode="decimal"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </Field>
              <Field label="Data">
                <input
                  type="date"
                  className={inputClass}
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Categoria">
              <select
                className={inputClass}
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              >
                {listaCategorias.map((c: string) => (
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
                value={form.escopo}
                onChange={(v) => setForm((f) => ({ ...f, escopo: v === 'empresa' ? 'empresa' : 'pessoal' }))}
              />
            </Field>

            {dados.meio || dados.documento ? (
              <p className="text-xs text-muted">
                {[dados.meio, dados.documento ? `CNPJ ${dados.documento}` : null].filter(Boolean).join(' · ')}
              </p>
            ) : null}

            <p className="text-sm text-muted">Confira os dados antes de salvar. A leitura automática pode errar.</p>

            {conta ? (
              <Card className="border-primary">
                <p className="text-sm text-ink">
                  Encontrei a conta {conta.descricao} de {brl(conta.valor)}, vencimento {fmtDate(conta.vencimento)}.
                </p>
                <div className="mt-3">
                  <Segmented
                    options={[
                      { value: 'pagar', label: 'Marcar essa conta como paga' },
                      { value: 'novo', label: 'Criar um lançamento novo' },
                    ]}
                    value={marcarConta ? 'pagar' : 'novo'}
                    onChange={(v) => setMarcarConta(v === 'pagar')}
                  />
                </div>
              </Card>
            ) : null}

            {erroSalvar ? <ErrorNote message={erroSalvar} /> : null}

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button type="button" variant="ghost" onClick={resetar} disabled={salvando}>
                Tentar outro arquivo
              </Button>
              <Button type="button" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        ) : null}

        {etapa === 'salvo' ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <CheckCircle2 size={32} className="text-income" />
            <p className="font-display text-lg font-semibold text-ink">Comprovante registrado</p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button type="button" variant="ghost" onClick={resetar}>
                Importar outro
              </Button>
              <Button type="button" onClick={fechar}>
                Fechar
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
