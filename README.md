# Jarvis: gestão financeira pessoal e da empresa

Sistema de finanças com painel, lançamentos, contas a pagar e a receber, orçamento por categoria, metas, cartões e faturas, investimentos e assistente de IA.

## Tecnologias

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Banco de dados **PostgreSQL** (estrutura completa em `database/schema.sql`)

## Banco de dados

Todas as informações ficam no PostgreSQL, em seis tabelas: `transacoes`, `contas`, `cartoes`, `orcamentos`, `metas` e `investimentos`. Cada linha pertence a um usuário e as políticas de segurança por linha (RLS) garantem que cada pessoa só acessa os próprios dados.

Para recriar o banco num PostgreSQL próprio:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

## Parcelamento automático

Em lançamentos e em contas a pagar/receber é possível escolher **Parcelado**, informar o número de parcelas (2 a 120) e se o valor digitado é o total ou o valor de cada parcela. O sistema:

- divide o total em centavos exatos (a soma das parcelas é sempre igual ao total; os centavos que sobram vão para as primeiras parcelas);
- cria uma parcela por mês a partir da data da primeira, ajustando o dia em meses mais curtos (31/01 vira 28/02 ou 29/02);
- liga todas as parcelas pelo mesmo `grupo_parcela`, com `parcela_num` e `parcelas_total`, para mostrar "3/12" e permitir excluir todas de uma vez;
- em compras no cartão, cada parcela cai na fatura do mês correspondente e todas ocupam o limite.

A regra fica em `src/lib/finance.ts` (`gerarParcelas` e `addMonthsISO`).

## Rodar localmente

```bash
npm install
npm run dev
```
