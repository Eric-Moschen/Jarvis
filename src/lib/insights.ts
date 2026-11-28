// Alertas de vencimento, sugestões de gestão e relatório mensal.
// Funções puras: recebem os dados e a data de hoje (YYYY-MM-DD), sem acessar o banco.
import { addMonthsKey, brl, fmtDate, invoiceCycle, monthKey, monthTotals, parseISO, spendByCategory, sum, usedLimit } from './finance'
import type { Cartao, Conta, Investimento, Meta, Orcamento, Transacao } from './types'

export interface Dados {
  transacoes: Transacao[]
  contas: Conta[]
  cartoes: Cartao[]
  orcamentos: Orcamento[]
  metas: Meta[]
  investimentos: Investimento[]
}

const diasEntre = (de: string, ate: string) => Math.round((parseISO(ate).getTime() - parseISO(de).getTime()) / 86400000)
const round2 = (n: number) => Math.round(n * 100) / 100

/* ------------------------------------------------------------------ */
/* Alertas de vencimento                                               */
/* ------------------------------------------------------------------ */

export type NivelAlerta = 'atrasada' | 'hoje' | 'em_breve'

export interface Alerta {
  id: string
  nivel: NivelAlerta
  titulo: string
  detalhe: string
  valor: number
  data: string
  rota: string
}

function textoPrazo(dias: number, data: string) {
  if (dias < 0) return dias === -1 ? 'Venceu ontem' : `Venceu há ${-dias} dias`
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanhã'
  return `Vence em ${dias} dias, ${fmtDate(data)}`
}

/** Fatura de cartão que vence a seguir: a fechada aguardando pagamento ou a aberta. */
export function proximaFatura(c: Cartao, tx: Transacao[], hoje: string) {
  const atual = invoiceCycle(c, parseISO(hoje))
  const diaAntes = parseISO(atual.inicio)
  diaAntes.setDate(diaAntes.getDate() - 1)
  const anterior = invoiceCycle(c, diaAntes)
  const ciclo = anterior.vencimento >= hoje ? anterior : atual
  const total = sum(
    tx.filter((t) => t.cartao_id === c.id && t.tipo === 'despesa' && t.data >= ciclo.inicio && t.data <= ciclo.fim).map((t) => t.valor),
  )
  return { ...ciclo, total: round2(total), fechada: ciclo === anterior }
}

/**
 * Contas pendentes atrasadas ou que vencem em até `janela` dias, e faturas de cartão
 * com valor que vencem nesse prazo. Ordem: atrasadas, hoje, próximas (por data).
 */
export function alertasVencimento(d: Dados, hoje: string, janela = 7): Alerta[] {
  const lista: Alerta[] = []
  for (const c of d.contas) {
    if (c.status !== 'pendente') continue
    const dias = diasEntre(hoje, c.vencimento)
    if (dias > janela) continue
    lista.push({
      id: `conta-${c.id}`,
      nivel: dias < 0 ? 'atrasada' : dias === 0 ? 'hoje' : 'em_breve',
      titulo: `${c.tipo === 'pagar' ? 'Pagar' : 'Receber'}: ${c.descricao}`,
      detalhe: textoPrazo(dias, c.vencimento),
      valor: c.valor,
      data: c.vencimento,
      rota: '/contas',
    })
  }
  for (const c of d.cartoes) {
    const f = proximaFatura(c, d.transacoes, hoje)
    if (f.total <= 0) continue
    const dias = diasEntre(hoje, f.vencimento)
    if (dias < 0 || dias > janela) continue
    lista.push({
      id: `fatura-${c.id}-${f.vencimento}`,
      nivel: dias === 0 ? 'hoje' : 'em_breve',
      titulo: `Fatura ${c.nome}${f.fechada ? ' (fechada)' : ''}`,
      detalhe: textoPrazo(dias, f.vencimento),
      valor: f.total,
      data: f.vencimento,
      rota: '/cartoes',
    })
  }
  const peso: Record<NivelAlerta, number> = { atrasada: 0, hoje: 1, em_breve: 2 }
  return lista.sort((a, b) => peso[a.nivel] - peso[b.nivel] || a.data.localeCompare(b.data))
}

/* ------------------------------------------------------------------ */
/* Relatório mensal                                                    */
/* ------------------------------------------------------------------ */

export interface Relatorio {
  mes: string
  receitas: number
  despesas: number
  saldo: number
  /** Parte da receita que sobrou (0.25 = 25%). null sem receita. */
  taxaPoupanca: number | null
  anterior: { receitas: number; despesas: number; saldo: number }
  /** Variação das despesas sobre o mês anterior (0.1 = +10%). null se o anterior foi zero. */
  variacaoDespesas: number | null
  porCategoria: { categoria: string; valor: number; pct: number; anterior: number }[]
  receitasPorCategoria: { categoria: string; valor: number }[]
  maioresDespesas: Transacao[]
  contasPagas: { qtd: number; valor: number }
  contasPendentes: { qtd: number; valor: number }
  contasAReceber: { qtd: number; valor: number }
  orcamentosEstourados: { categoria: string; limite: number; gasto: number }[]
  investido: number
  patrimonioInvestimentos: number
  qtdLancamentos: number
}

export function relatorioMensal(d: Dados, mes: string): Relatorio {
  const atual = monthTotals(d.transacoes, mes)
  const ant = monthTotals(d.transacoes, addMonthsKey(mes, -1))
  const cats = spendByCategory(d.transacoes, mes)
  const catsAnt = new Map(spendByCategory(d.transacoes, addMonthsKey(mes, -1)).map((c) => [c.categoria, c.valor]))
  const doMes = d.transacoes.filter((t) => monthKey(t.data) === mes)

  const recCat = new Map<string, number>()
  for (const t of doMes) if (t.tipo === 'receita') recCat.set(t.categoria, (recCat.get(t.categoria) ?? 0) + t.valor)

  const contasMes = d.contas.filter((c) => monthKey(c.vencimento) === mes)
  const pagas = contasMes.filter((c) => c.tipo === 'pagar' && c.status === 'pago')
  const pendentes = contasMes.filter((c) => c.tipo === 'pagar' && c.status === 'pendente')
  const receber = contasMes.filter((c) => c.tipo === 'receber' && c.status === 'pendente')

  const estourados = d.orcamentos
    .map((o) => ({
      categoria: o.categoria,
      limite: o.limite,
      gasto: round2(sum(doMes.filter((t) => t.tipo === 'despesa' && t.categoria === o.categoria && t.escopo === o.escopo).map((t) => t.valor))),
    }))
    .filter((o) => o.gasto > o.limite)

  return {
    mes,
    receitas: round2(atual.receitas),
    despesas: round2(atual.despesas),
    saldo: round2(atual.saldo),
    taxaPoupanca: atual.receitas > 0 ? atual.saldo / atual.receitas : null,
    anterior: { receitas: round2(ant.receitas), despesas: round2(ant.despesas), saldo: round2(ant.saldo) },
    variacaoDespesas: ant.despesas > 0 ? (atual.despesas - ant.despesas) / ant.despesas : null,
    porCategoria: cats.map((c) => ({
      categoria: c.categoria,
      valor: round2(c.valor),
      pct: atual.despesas > 0 ? c.valor / atual.despesas : 0,
      anterior: round2(catsAnt.get(c.categoria) ?? 0),
    })),
    receitasPorCategoria: [...recCat.entries()].map(([categoria, valor]) => ({ categoria, valor: round2(valor) })).sort((a, b) => b.valor - a.valor),
    maioresDespesas: doMes.filter((t) => t.tipo === 'despesa').sort((a, b) => b.valor - a.valor).slice(0, 5),
    contasPagas: { qtd: pagas.length, valor: round2(sum(pagas.map((c) => c.valor))) },
    contasPendentes: { qtd: pendentes.length, valor: round2(sum(pendentes.map((c) => c.valor))) },
    contasAReceber: { qtd: receber.length, valor: round2(sum(receber.map((c) => c.valor))) },
    orcamentosEstourados: estourados,
    investido: round2(sum(d.investimentos.map((i) => i.valor_investido))),
    patrimonioInvestimentos: round2(sum(d.investimentos.map((i) => i.valor_atual))),
    qtdLancamentos: doMes.length,
  }
}

/** Relatório em CSV (separador ;, padrão do Excel em português). */
export function relatorioCSV(r: Relatorio): string {
  const n = (v: number) => v.toFixed(2).replace('.', ',')
  const linhas: string[][] = [
    ['Relatório', r.mes],
    [],
    ['Resumo', 'Valor'],
    ['Receitas', n(r.receitas)],
    ['Despesas', n(r.despesas)],
    ['Saldo', n(r.saldo)],
    ['Contas pagas', n(r.contasPagas.valor)],
    ['Contas pendentes', n(r.contasPendentes.valor)],
    ['A receber', n(r.contasAReceber.valor)],
    [],
    ['Despesas por categoria', 'Valor', 'Mês anterior', '% do total'],
    ...r.porCategoria.map((c) => [c.categoria, n(c.valor), n(c.anterior), (c.pct * 100).toFixed(1).replace('.', ',') + '%']),
    [],
    ['Receitas por categoria', 'Valor'],
    ...r.receitasPorCategoria.map((c) => [c.categoria, n(c.valor)]),
  ]
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return linhas.map((l) => l.map(esc).join(';')).join('\n')
}

/* ------------------------------------------------------------------ */
/* Sugestões de gestão com base nos meses anteriores                   */
/* ------------------------------------------------------------------ */

export type TipoSugestao = 'atencao' | 'oportunidade' | 'positivo'

export interface Sugestao {
  id: string
  tipo: TipoSugestao
  titulo: string
  texto: string
  rota?: string
}

/** Média mensal dos 3 meses completos anteriores ao mês de `hoje`. */
export function mediasAnteriores(d: Dados, hoje: string) {
  const mesAtual = monthKey(hoje)
  const meses = [1, 2, 3].map((i) => addMonthsKey(mesAtual, -i))
  const comDados = meses.filter((m) => d.transacoes.some((t) => monthKey(t.data) === m))
  const base = comDados.length || 1
  const tot = comDados.map((m) => monthTotals(d.transacoes, m))
  const porCat = new Map<string, number>()
  for (const m of comDados) for (const c of spendByCategory(d.transacoes, m)) porCat.set(c.categoria, (porCat.get(c.categoria) ?? 0) + c.valor)
  return {
    meses: comDados,
    receitas: sum(tot.map((t) => t.receitas)) / base,
    despesas: sum(tot.map((t) => t.despesas)) / base,
    saldo: sum(tot.map((t) => t.saldo)) / base,
    categorias: new Map([...porCat.entries()].map(([k, v]) => [k, v / base])),
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function sugestoes(d: Dados, hoje: string): Sugestao[] {
  const out: Sugestao[] = []
  const mesAtual = monthKey(hoje)
  const media = mediasAnteriores(d, hoje)

  // Contas atrasadas
  const atrasadas = d.contas.filter((c) => c.tipo === 'pagar' && c.status === 'pendente' && c.vencimento < hoje)
  if (atrasadas.length > 0) {
    out.push({
      id: 'atrasadas',
      tipo: 'atencao',
      titulo: `${atrasadas.length} ${atrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'}`,
      texto: `Somam ${brl(sum(atrasadas.map((c) => c.valor)))}. Pague primeiro as que cobram juros e multa e marque como pagas para manter o saldo certo.`,
      rota: '/contas',
    })
  }

  if (media.meses.length === 0) {
    out.push({
      id: 'sem-historico',
      tipo: 'oportunidade',
      titulo: 'Registre um mês completo',
      texto: 'Com pelo menos um mês de receitas e despesas lançadas, eu passo a comparar seus gastos e apontar onde dá para economizar.',
      rota: '/transacoes',
    })
  } else {
    // Poupança
    if (media.receitas > 0) {
      const taxa = media.saldo / media.receitas
      if (taxa < 0) {
        out.push({
          id: 'deficit',
          tipo: 'atencao',
          titulo: 'Você gastou mais do que ganhou',
          texto: `Na média dos últimos ${media.meses.length} ${media.meses.length === 1 ? 'mês' : 'meses'}, as despesas (${brl(media.despesas)}) passaram das receitas (${brl(media.receitas)}). Corte primeiro nas categorias que mais cresceram.`,
          rota: '/orcamento',
        })
      } else if (taxa < 0.1) {
        out.push({
          id: 'poupanca-baixa',
          tipo: 'oportunidade',
          titulo: `Sobra só ${pct(taxa)} do que entra`,
          texto: `Tente guardar ao menos 10% das receitas, cerca de ${brl(media.receitas * 0.1)} por mês, separando o valor logo que o dinheiro entra.`,
          rota: '/orcamento',
        })
      } else if (taxa >= 0.2) {
        out.push({
          id: 'poupanca-boa',
          tipo: 'positivo',
          titulo: `Você guarda ${pct(taxa)} do que ganha`,
          texto: `Ótimo ritmo: sobram em média ${brl(media.saldo)} por mês. Direcione essa sobra para metas e investimentos.`,
          rota: '/investimentos',
        })
      }
    } else if (media.despesas > 0) {
      out.push({
        id: 'sem-receita',
        tipo: 'oportunidade',
        titulo: 'Lance também suas receitas',
        texto: 'Há despesas registradas, mas nenhuma receita nos últimos meses. Sem elas não dá para saber quanto sobra.',
        rota: '/transacoes',
      })
    }

    // Categorias do mês atual acima da média
    for (const c of spendByCategory(d.transacoes, mesAtual)) {
      const m = media.categorias.get(c.categoria) ?? 0
      if (m > 0 && c.valor > m * 1.3 && c.valor - m >= 50) {
        out.push({
          id: `alta-${c.categoria}`,
          tipo: 'atencao',
          titulo: `${c.categoria}: ${pct(c.valor / m - 1)} acima da média`,
          texto: `Neste mês já foram ${brl(c.valor)}, contra ${brl(m)} na média dos meses anteriores.`,
          rota: '/transacoes',
        })
      }
    }

    // Concentração em uma categoria
    const cats = [...media.categorias.entries()].sort((a, b) => b[1] - a[1])
    if (cats.length > 1 && media.despesas > 0 && cats[0][1] / media.despesas > 0.4) {
      out.push({
        id: 'concentracao',
        tipo: 'oportunidade',
        titulo: `${cats[0][0]} pesa ${pct(cats[0][1] / media.despesas)} dos gastos`,
        texto: `É a sua maior despesa, com ${brl(cats[0][1])} por mês. Uma redução de 10% nela libera ${brl(cats[0][1] * 0.1)} por mês.`,
        rota: '/orcamento',
      })
    }

    // Assinaturas
    const assin = media.categorias.get('Assinaturas') ?? 0
    if (assin > 0 && media.receitas > 0 && assin / media.receitas > 0.05) {
      out.push({
        id: 'assinaturas',
        tipo: 'oportunidade',
        titulo: 'Revise suas assinaturas',
        texto: `Elas custam ${brl(assin)} por mês, ${pct(assin / media.receitas)} das receitas. Cancele as que não usou no último mês.`,
        rota: '/transacoes',
      })
    }

    // Reserva de emergência
    const reserva = sum(d.investimentos.filter((i) => i.tipo === 'Reserva de emergência').map((i) => i.valor_atual))
    if (media.despesas > 0) {
      const meses = reserva / media.despesas
      if (meses < 6) {
        out.push({
          id: 'reserva',
          tipo: 'oportunidade',
          titulo: reserva > 0 ? `Sua reserva cobre ${meses.toFixed(1).replace('.', ',')} meses` : 'Monte uma reserva de emergência',
          texto: `O ideal é ter 6 meses de despesas guardados, cerca de ${brl(media.despesas * 6)}, em aplicação com resgate imediato.`,
          rota: '/investimentos',
        })
      }
    }

    // Orçamento
    if (d.orcamentos.length === 0 && cats.length > 0) {
      out.push({
        id: 'sem-orcamento',
        tipo: 'oportunidade',
        titulo: 'Defina limites por categoria',
        texto: `Comece pelas maiores: ${cats.slice(0, 3).map(([k]) => k).join(', ')}. Eu aviso quando um limite estiver perto de estourar.`,
        rota: '/orcamento',
      })
    } else {
      const ant = relatorioMensal(d, addMonthsKey(mesAtual, -1))
      for (const o of ant.orcamentosEstourados) {
        out.push({
          id: `estouro-${o.categoria}`,
          tipo: 'atencao',
          titulo: `Orçamento de ${o.categoria} estourou no mês passado`,
          texto: `Gasto de ${brl(o.gasto)} para um limite de ${brl(o.limite)}. Ajuste o limite à realidade ou corte nessa categoria.`,
          rota: '/orcamento',
        })
      }
    }
  }

  // Cartões perto do limite
  for (const c of d.cartoes) {
    if (c.limite <= 0) continue
    const uso = usedLimit(c, d.transacoes, parseISO(hoje)) / c.limite
    if (uso >= 0.8) {
      out.push({
        id: `cartao-${c.id}`,
        tipo: 'atencao',
        titulo: `${c.nome} com ${pct(uso)} do limite usado`,
        texto: 'Usar mais de 30% do limite costuma pesar no orçamento do mês seguinte. Evite novas compras parceladas nele.',
        rota: '/cartoes',
      })
    }
  }

  // Metas com prazo
  for (const m of d.metas) {
    if (!m.prazo || m.valor_atual >= m.valor_alvo) continue
    const mesesRestantes = Math.max(1, (Number(m.prazo.slice(0, 4)) - Number(hoje.slice(0, 4))) * 12 + Number(m.prazo.slice(5, 7)) - Number(hoje.slice(5, 7)))
    const porMes = (m.valor_alvo - m.valor_atual) / mesesRestantes
    if (m.prazo < hoje) {
      out.push({ id: `meta-${m.id}`, tipo: 'atencao', titulo: `Prazo da meta "${m.nome}" passou`, texto: `Faltam ${brl(m.valor_alvo - m.valor_atual)}. Defina um novo prazo realista.`, rota: '/orcamento' })
    } else if (media.meses.length > 0 && porMes > Math.max(0, media.saldo)) {
      out.push({
        id: `meta-${m.id}`,
        tipo: 'atencao',
        titulo: `Meta "${m.nome}" precisa de ${brl(porMes)} por mês`,
        texto: `Isso é mais do que sobra em média (${brl(Math.max(0, media.saldo))}). Aumente o prazo ou reduza gastos para chegar lá.`,
        rota: '/orcamento',
      })
    }
  }

  // Investimentos concentrados
  const totalInv = sum(d.investimentos.map((i) => i.valor_atual))
  if (totalInv > 0 && d.investimentos.length > 1) {
    const porTipo = new Map<string, number>()
    for (const i of d.investimentos) porTipo.set(i.tipo, (porTipo.get(i.tipo) ?? 0) + i.valor_atual)
    const [tipo, valor] = [...porTipo.entries()].sort((a, b) => b[1] - a[1])[0]
    if (porTipo.size > 1 && valor / totalInv > 0.8 && tipo !== 'Reserva de emergência') {
      out.push({ id: 'diversificar', tipo: 'oportunidade', titulo: `${pct(valor / totalInv)} dos investimentos em ${tipo}`, texto: 'Distribuir entre tipos diferentes reduz o risco de uma perda grande de uma vez.', rota: '/investimentos' })
    }
  }

  const peso: Record<TipoSugestao, number> = { atencao: 0, oportunidade: 1, positivo: 2 }
  return out.sort((a, b) => peso[a.tipo] - peso[b.tipo]).slice(0, 10)
}
