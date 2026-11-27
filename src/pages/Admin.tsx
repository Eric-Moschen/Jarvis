import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { ai, type AiSettings, type AiStatus } from '../lib/1dollar-ai'
import {
  Button,
  Card,
  ErrorNote,
  Field,
  PageHeader,
  inputClass,
} from '../components/ui'

export function Admin() {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const s = await ai.status()
      setStatus(s)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Não consegui carregar a configuração.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  return (
    <div>
      <PageHeader title="Configurar IA" subtitle="Ative o assistente com a sua chave da OpenAI" />

      {loading ? (
        <Card className="flex items-center gap-3 text-soft">
          <Loader2 className="animate-spin text-primary" size={18} />
          <span className="text-sm">Carregando configuração...</span>
        </Card>
      ) : loadError ? (
        <div className="space-y-3">
          <ErrorNote message={loadError} />
          <Button variant="ghost" onClick={() => void loadStatus()}>
            Tentar de novo
          </Button>
        </div>
      ) : status ? (
        <div className="space-y-6">
          <StatusCard status={status} />

          {!status.admin ? (
            <Card>
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warn" />
                <p className="text-sm text-soft">
                  Somente o dono do site pode alterar estas configurações. Entre com o mesmo e-mail da sua conta
                  1dollar (e-mail confirmado).
                </p>
              </div>
            </Card>
          ) : (
            <>
              <KeyCard status={status} onUpdated={setStatus} />
              <SettingsCard status={status} onUpdated={setStatus} />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function StatusCard({ status }: { status: AiStatus }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <KeyRound
          size={20}
          strokeWidth={1.75}
          className={status.configured ? 'mt-0.5 shrink-0 text-income' : 'mt-0.5 shrink-0 text-soft'}
        />
        <div className="min-w-0">
          <div className={status.configured ? 'font-display text-base font-medium text-income' : 'font-display text-base font-medium text-ink'}>
            {status.configured ? 'Assistente ativo' : 'Assistente desligado'}
          </div>
          {status.configured && status.hint ? (
            <p className="mt-1 text-sm text-soft">Chave cadastrada: {status.hint}</p>
          ) : (
            <p className="mt-1 text-sm text-soft">
              {status.configured
                ? 'A chave está configurada no servidor.'
                : 'Cadastre a chave da OpenAI para liberar as respostas do Jarvis.'}
            </p>
          )}
          {typeof status.usedToday === 'number' ? (
            <p className="mt-2 text-xs text-soft tabular">Mensagens usadas hoje: {status.usedToday}</p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function KeyCard({ status, onUpdated }: { status: AiStatus; onUpdated: (s: AiStatus) => void }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    const key = apiKey.trim()
    if (!key) {
      setError('Cole a chave da OpenAI antes de salvar.')
      return
    }
    setSaving(true)
    try {
      const res = await ai.saveKey(key)
      setApiKey('')
      setOk('Chave salva. O assistente já pode responder.')
      onUpdated({ ...status, configured: true, hint: res.hint })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar a chave.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    const confirmado = window.confirm('Remover a chave da OpenAI? O assistente para de responder até você cadastrar outra.')
    if (!confirmado) return
    setError(null)
    setOk(null)
    setRemoving(true)
    try {
      await ai.removeKey()
      setOk('Chave removida.')
      onUpdated({ ...status, configured: false, hint: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui remover a chave.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink">Chave da OpenAI</h2>
      <p className="mt-1 text-sm text-soft">A chave fica cifrada no servidor da 1dollar. O navegador nunca a vê.</p>

      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <Field label="Nova chave">
          <input
            className={inputClass}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        {error && <ErrorNote message={error} />}
        {ok && <div className="rounded-lg bg-income/10 px-3 py-2 text-sm text-income">{ok}</div>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="danger" onClick={() => void handleRemove()} disabled={removing || saving || !status.configured}>
            {removing ? 'Removendo...' : 'Remover chave'}
          </Button>
          <Button type="submit" disabled={saving || removing}>
            {saving ? 'Salvando...' : 'Salvar chave'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function SettingsCard({ status, onUpdated }: { status: AiStatus; onUpdated: (s: AiStatus) => void }) {
  const base: AiSettings = status.settings ?? {
    imageModel: '',
    textModel: '',
    perVisitorDay: 0,
    totalDay: 0,
  }

  const [perVisitorDay, setPerVisitorDay] = useState(String(base.perVisitorDay || ''))
  const [totalDay, setTotalDay] = useState(String(base.totalDay || ''))
  const [textModel, setTextModel] = useState(base.textModel)
  const [imageModel, setImageModel] = useState(base.imageModel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)

    const pv = Number(perVisitorDay)
    const td = Number(totalDay)
    if (!Number.isInteger(pv) || pv < 1) {
      setError('Mensagens por visitante por dia precisa ser um número inteiro maior ou igual a 1.')
      return
    }
    if (!Number.isInteger(td) || td < 1) {
      setError('Total por dia precisa ser um número inteiro maior ou igual a 1.')
      return
    }
    if (!textModel.trim()) {
      setError('Informe o modelo de texto.')
      return
    }
    if (!imageModel.trim()) {
      setError('Informe o modelo de imagem.')
      return
    }

    setSaving(true)
    try {
      const res = await ai.saveSettings({
        perVisitorDay: pv,
        totalDay: td,
        textModel: textModel.trim(),
        imageModel: imageModel.trim(),
      })
      setOk('Limites e modelos salvos.')
      onUpdated({ ...status, settings: res.settings })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar os limites.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={18} strokeWidth={1.75} className="text-soft" />
        <h2 className="font-display text-lg font-semibold text-ink">Limites e modelos</h2>
      </div>

      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mensagens por visitante por dia">
            <input
              className={inputClass + ' tabular'}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={perVisitorDay}
              onChange={(e) => setPerVisitorDay(e.target.value)}
            />
          </Field>
          <Field label="Total por dia">
            <input
              className={inputClass + ' tabular'}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={totalDay}
              onChange={(e) => setTotalDay(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Modelo de texto">
            <input
              className={inputClass}
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              placeholder="gpt-4o-mini"
              spellCheck={false}
            />
          </Field>
          <Field label="Modelo de imagem">
            <input
              className={inputClass}
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              placeholder="gpt-image-1"
              spellCheck={false}
            />
          </Field>
        </div>

        {error && <ErrorNote message={error} />}
        {ok && <div className="rounded-lg bg-income/10 px-3 py-2 text-sm text-income">{ok}</div>}

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar limites'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
