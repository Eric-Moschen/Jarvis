// 1dollar Pix (ExPay). Arquivo gerado: não edite, ele é regravado pela 1dollar.
// A chave da ExPay fica no servidor da 1dollar (o dono conecta em Conectores > ExPay); o navegador nunca a vê.

const API = "https://api-v10.1dollar.com.br/project-pix/8b590d6a-aa7e-47ef-852d-3c0ecc714f31"

export type PixStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'expired' | 'canceled'
/** copyPaste: código Pix copia e cola. qrCode: imagem do QR (data URL) para usar em <img src>. amount em reais. */
export type PixCharge = { id: string; amount: number; status: PixStatus; reference: string | null; copyPaste: string | null; qrCode: string | null; paidAt: string | null; expiresAt: string | null }

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(API + path, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error('Não consegui falar com o servidor. Verifique sua conexão.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Não consegui gerar o Pix. Tente de novo.'), { status: res.status, code: data.code })
  return data as T
}

export const pix = {
  /** O Pix está configurado neste site (o dono conectou a ExPay)? */
  status: () => call<{ configured: boolean }>('/status'),
  /** Gera uma cobrança Pix. amount em reais (ex.: 49.9). reference: id do pedido no site. */
  create: (p: { amount: number; description?: string; reference?: string; customer?: { name?: string; document?: string; email?: string } }) => call<PixCharge>('/charges', 'POST', p),
  /** Situação atual da cobrança. */
  get: (id: string) => call<PixCharge>('/charges/' + encodeURIComponent(id)),
  /** Confere a cada poucos segundos até ser paga (ou expirar/cancelar). Chama onUpdate a cada consulta. Devolve uma função para parar. */
  watch(id: string, onUpdate: (c: PixCharge) => void, everyMs = 4000) {
    let stopped = false
    const tick = async () => {
      if (stopped) return
      try {
        const c = await pix.get(id)
        onUpdate(c)
        if (c.status !== 'pending') return
      } catch { /* tenta de novo no próximo ciclo */ }
      if (!stopped) setTimeout(tick, everyMs)
    }
    void tick()
    return () => { stopped = true }
  },
}
