-- Jarvis: estrutura completa do banco PostgreSQL
-- Este é o mesmo esquema que roda no banco do projeto (1dollar Database, PostgreSQL).
-- Para recriar num PostgreSQL próprio (14+), rode este arquivo inteiro.
--
-- Cada linha pertence a um usuário (user_id). As políticas de RLS garantem que
-- cada pessoa só lê e altera os próprios dados. A função app_uid() devolve o id do
-- usuário logado; num servidor próprio, defina-o por conexão com:
--   SET app.user_id = 'id-do-usuario';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION app_uid() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;

-- Lançamentos (receitas e despesas), com parcelamento automático
CREATE TABLE IF NOT EXISTS transacoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL DEFAULT app_uid(),
  tipo           text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  descricao      text NOT NULL,
  valor          numeric(14,2) NOT NULL CHECK (valor > 0),
  data           date NOT NULL DEFAULT current_date,
  categoria      text NOT NULL DEFAULT 'Outros',
  escopo         text NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal', 'empresa')),
  cartao_id      uuid,
  grupo_parcela  uuid,
  parcela_num    integer,
  parcelas_total integer,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transacoes_parcela_ck CHECK (
    (grupo_parcela IS NULL AND parcela_num IS NULL AND parcelas_total IS NULL)
    OR (grupo_parcela IS NOT NULL AND parcelas_total BETWEEN 1 AND 120 AND parcela_num BETWEEN 1 AND parcelas_total)
  )
);

-- Contas a pagar e a receber (únicas, repetidas ou parceladas)
CREATE TABLE IF NOT EXISTS contas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL DEFAULT app_uid(),
  tipo           text NOT NULL CHECK (tipo IN ('pagar', 'receber')),
  descricao      text NOT NULL,
  valor          numeric(14,2) NOT NULL CHECK (valor > 0),
  vencimento     date NOT NULL,
  categoria      text NOT NULL DEFAULT 'Outros',
  escopo         text NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal', 'empresa')),
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  pago_em        date,
  grupo_parcela  uuid,
  parcela_num    integer,
  parcelas_total integer,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contas_parcela_ck CHECK (
    (grupo_parcela IS NULL AND parcela_num IS NULL AND parcelas_total IS NULL)
    OR (grupo_parcela IS NOT NULL AND parcelas_total BETWEEN 1 AND 120 AND parcela_num BETWEEN 1 AND parcelas_total)
  )
);

-- Cartões de crédito
CREATE TABLE IF NOT EXISTS cartoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL DEFAULT app_uid(),
  nome           text NOT NULL,
  limite         numeric(14,2) NOT NULL DEFAULT 0,
  dia_fechamento integer NOT NULL DEFAULT 1 CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento integer NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31),
  escopo         text NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal', 'empresa')),
  criado_em      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transacoes
  DROP CONSTRAINT IF EXISTS transacoes_cartao_fk,
  ADD CONSTRAINT transacoes_cartao_fk FOREIGN KEY (cartao_id) REFERENCES cartoes(id) ON DELETE SET NULL;

-- Orçamento mensal por categoria
CREATE TABLE IF NOT EXISTS orcamentos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL DEFAULT app_uid(),
  categoria  text NOT NULL,
  limite     numeric(14,2) NOT NULL CHECK (limite > 0),
  escopo     text NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal', 'empresa')),
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Metas financeiras
CREATE TABLE IF NOT EXISTS metas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL DEFAULT app_uid(),
  nome        text NOT NULL,
  valor_alvo  numeric(14,2) NOT NULL CHECK (valor_alvo > 0),
  valor_atual numeric(14,2) NOT NULL DEFAULT 0,
  prazo       date,
  escopo      text NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal', 'empresa')),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- Investimentos e patrimônio
CREATE TABLE IF NOT EXISTS investimentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL DEFAULT app_uid(),
  nome            text NOT NULL,
  tipo            text NOT NULL DEFAULT 'Renda fixa',
  valor_investido numeric(14,2) NOT NULL,
  valor_atual     numeric(14,2) NOT NULL,
  data            date NOT NULL DEFAULT current_date,
  escopo          text NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal', 'empresa')),
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- Índices pelas consultas do sistema
CREATE INDEX IF NOT EXISTS transacoes_user_id_data_idx ON transacoes (user_id, data DESC);
CREATE INDEX IF NOT EXISTS transacoes_cartao_id_idx ON transacoes (cartao_id);
CREATE INDEX IF NOT EXISTS transacoes_user_id_grupo_parcela_idx ON transacoes (user_id, grupo_parcela) WHERE grupo_parcela IS NOT NULL;
CREATE INDEX IF NOT EXISTS contas_user_id_status_vencimento_idx ON contas (user_id, status, vencimento);
CREATE INDEX IF NOT EXISTS contas_user_id_grupo_parcela_idx ON contas (user_id, grupo_parcela) WHERE grupo_parcela IS NOT NULL;
CREATE INDEX IF NOT EXISTS cartoes_user_id_criado_em_idx ON cartoes (user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS orcamentos_user_id_escopo_idx ON orcamentos (user_id, escopo);
CREATE INDEX IF NOT EXISTS metas_user_id_criado_em_idx ON metas (user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS investimentos_user_id_criado_em_idx ON investimentos (user_id, criado_em DESC);

-- Segurança por linha: cada usuário só vê e altera o que é dele
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transacoes','contas','cartoes','orcamentos','metas','investimentos'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS dono ON %I', t);
    EXECUTE format('CREATE POLICY dono ON %I USING (user_id = app_uid()) WITH CHECK (user_id = app_uid())', t);
  END LOOP;
END $$;
