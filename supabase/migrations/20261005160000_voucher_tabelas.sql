-- Fase 1 (item 1.1): atividades, sessões, vouchers e limites de requisição.
--
-- Regras (PLANO D3, D4, D5, D6, D7, D9, D10):
--   * O voucher pertence a uma atividade; atividade em modo 'reserva' tem sessões com
--     capacidade opcional em pessoas; 'registro_voluntario' não tem sessões nem limite.
--   * Relacionamentos entre tabelas de município usam FK composta (municipio_id, ...).
--   * Ninguém grava vouchers diretamente: emissão, confirmação, cancelamento e expiração
--     passam pelas funções da migration seguinte.
--   * Anônimo não lê vouchers. Operador também não lê a tabela: confere pela função
--     conferir_voucher, que devolve só os campos necessários.

-- ---------------------------------------------------------------------------
-- atividades
-- ---------------------------------------------------------------------------

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 3 and 120),
  descricao text check (descricao is null or length(descricao) <= 4000),
  local_encontro text check (local_encontro is null or length(local_encontro) <= 300),
  condicoes text check (condicoes is null or length(condicoes) <= 2000),
  modo text not null check (modo in ('registro_voluntario', 'reserva')),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  exige_responsavel boolean not null default false,
  exige_contato boolean not null default false,
  max_pessoas_por_voucher integer not null default 10 check (max_pessoas_por_voucher between 1 and 50),
  -- Atrativo opcional. A FK composta (municipio_id, atrativo_id) entra na Fase 2, com a tabela atrativos.
  atrativo_id uuid,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, id)
);

comment on table public.atividades is 'Atividades com voucher gratuito. Cadastrar um atrativo nunca cria atividade.';
comment on column public.atividades.modo is 'registro_voluntario: acesso livre, o cadastro não condiciona a entrada. reserva: sessões com data, horário e vagas.';

create index atividades_municipio_status_idx on public.atividades (municipio_id, status);

create trigger atividades_atualizado_em before update on public.atividades
  for each row execute function privado.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- sessoes
-- ---------------------------------------------------------------------------

create table public.sessoes (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null,
  atividade_id uuid not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  capacidade_pessoas integer check (capacidade_pessoas is null or capacidade_pessoas between 1 and 10000),
  pessoas_reservadas integer not null default 0 check (pessoas_reservadas >= 0),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (municipio_id, atividade_id) references public.atividades (municipio_id, id) on delete cascade,
  unique (municipio_id, id),
  unique (municipio_id, atividade_id, id),
  check (fim > inicio),
  check (fim - inicio <= interval '24 hours'),
  check (capacidade_pessoas is null or pessoas_reservadas <= capacidade_pessoas)
);

comment on column public.sessoes.capacidade_pessoas is 'Vagas em pessoas (não em vouchers). Nulo = sem limite.';
comment on column public.sessoes.pessoas_reservadas is 'Mantido só pelas funções de emissão e cancelamento, na mesma transação do voucher.';

create index sessoes_atividade_inicio_idx on public.sessoes (municipio_id, atividade_id, inicio);

create trigger sessoes_atualizado_em before update on public.sessoes
  for each row execute function privado.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- vouchers
-- ---------------------------------------------------------------------------

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null,
  atividade_id uuid not null,
  sessao_id uuid,
  codigo text not null unique check (codigo ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$'),
  token_hash bytea not null unique check (length(token_hash) = 32),
  chave_idempotencia uuid not null,
  origem text not null check (origem in ('publico', 'assistida')),
  status text not null default 'emitido' check (status in ('emitido', 'utilizado', 'cancelado', 'expirado')),
  data_visita date not null,
  pessoas integer not null check (pessoas between 1 and 50),
  pessoas_atendidas integer,
  cidade text not null check (length(trim(cidade)) between 2 and 80),
  uf text not null check (uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
                                 'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','EX')),
  nome_responsavel text check (nome_responsavel is null or length(trim(nome_responsavel)) between 2 and 120),
  contato text check (contato is null or length(trim(contato)) between 8 and 120),
  emitido_por uuid,
  emitido_em timestamptz not null default now(),
  utilizado_em timestamptz,
  utilizado_por uuid,
  cancelado_em timestamptz,
  cancelado_por uuid,
  cancelado_via text check (cancelado_via is null or cancelado_via in ('visitante', 'painel')),
  expirado_em timestamptz,
  foreign key (municipio_id, atividade_id) references public.atividades (municipio_id, id),
  foreign key (municipio_id, atividade_id, sessao_id) references public.sessoes (municipio_id, atividade_id, id),
  unique (municipio_id, chave_idempotencia),
  unique (municipio_id, id),
  check (pessoas_atendidas is null or pessoas_atendidas between 1 and pessoas),
  check ((status = 'utilizado') = (utilizado_em is not null and pessoas_atendidas is not null)),
  check ((status = 'cancelado') = (cancelado_em is not null and cancelado_via is not null)),
  check ((status = 'expirado') = (expirado_em is not null)),
  check (origem = 'publico' or emitido_por is not null)
);

comment on table public.vouchers is 'Vouchers gratuitos. Escrita só pelas funções do banco; o token do visitante fica apenas como hash SHA-256.';
comment on column public.vouchers.data_visita is 'Dia da atividade no fuso America/Araguaina (dia da sessão ou dia escolhido no registro voluntário).';
comment on column public.vouchers.uf is 'UF de origem; EX = exterior.';

create index vouchers_municipio_data_idx on public.vouchers (municipio_id, data_visita);
create index vouchers_sessao_idx on public.vouchers (sessao_id) where sessao_id is not null;
create index vouchers_emitidos_idx on public.vouchers (data_visita) where status = 'emitido';

-- ---------------------------------------------------------------------------
-- limites_requisicao (D9)
-- ---------------------------------------------------------------------------

create table public.limites_requisicao (
  escopo text not null check (escopo in ('emissao_publica', 'consulta_token')),
  chave text not null check (chave ~ '^[0-9a-f]{64}$'),
  alvo text not null,
  janela timestamptz not null,
  contagem integer not null default 0,
  primary key (escopo, chave, alvo, janela)
);

comment on table public.limites_requisicao is 'Contagem de requisições públicas por hash do IP, alvo (município ou *) e janela. Nunca guarda o IP.';

create index limites_requisicao_janela_idx on public.limites_requisicao (janela);

-- ---------------------------------------------------------------------------
-- Auditoria: atividades e sessões (alterações do gestor) e vouchers sem dados pessoais
-- ---------------------------------------------------------------------------

-- Generaliza o trigger da Fase 0: TG_ARGV[1] (opcional) lista colunas omitidas do registro,
-- separadas por vírgula. Usado para não copiar nome, contato e hash do token para a auditoria.
create or replace function privado.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_omitir text[] := case when tg_nargs > 1 then string_to_array(tg_argv[1], ',') else array[]::text[] end;
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - v_omitir end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - v_omitir end;
  v_linha jsonb := coalesce(v_depois, v_antes);
  v_coluna text := case when tg_nargs > 0 then tg_argv[0] end;
begin
  if tg_op = 'UPDATE' and v_antes = v_depois then
    return null;
  end if;
  insert into public.auditoria (usuario_id, municipio_id, tabela, operacao, registro_id, antes, depois)
  values (
    (select auth.uid()),
    case when v_coluna is not null then (v_linha ->> v_coluna)::uuid end,
    tg_table_name,
    tg_op,
    coalesce(v_linha ->> 'id', v_linha ->> 'user_id', v_linha ->> 'municipio_id'),
    v_antes,
    v_depois
  );
  return null;
end;
$$;

create trigger auditoria_atividades after insert or update or delete on public.atividades
  for each row execute function privado.registrar_auditoria('municipio_id');

-- Emissões e cancelamentos mexem em pessoas_reservadas; isso fica registrado no voucher,
-- não como alteração da sessão. Alterações feitas pelo gestor continuam auditadas.
create trigger auditoria_sessoes_inclusao_exclusao after insert or delete on public.sessoes
  for each row execute function privado.registrar_auditoria('municipio_id', 'pessoas_reservadas,atualizado_em');
create trigger auditoria_sessoes_alteracao after update on public.sessoes
  for each row
  when (old.inicio is distinct from new.inicio or old.fim is distinct from new.fim
        or old.capacidade_pessoas is distinct from new.capacidade_pessoas or old.ativa is distinct from new.ativa)
  execute function privado.registrar_auditoria('municipio_id', 'pessoas_reservadas,atualizado_em');

create trigger auditoria_vouchers after insert or update or delete on public.vouchers
  for each row execute function privado.registrar_auditoria('municipio_id', 'nome_responsavel,contato,token_hash,chave_idempotencia');

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos) e RLS
-- ---------------------------------------------------------------------------

revoke all on table public.atividades, public.sessoes, public.vouchers, public.limites_requisicao
  from anon, authenticated, service_role;

grant select on table public.atividades to anon, authenticated;
grant insert (municipio_id, titulo, descricao, local_encontro, condicoes, modo, status, exige_responsavel,
              exige_contato, max_pessoas_por_voucher, atrativo_id)
  on table public.atividades to authenticated;
grant update (titulo, descricao, local_encontro, condicoes, status, exige_responsavel, exige_contato,
              max_pessoas_por_voucher, atrativo_id)
  on table public.atividades to authenticated;

grant select on table public.sessoes to anon, authenticated;
grant insert (municipio_id, atividade_id, inicio, fim, capacidade_pessoas, ativa) on table public.sessoes to authenticated;
grant update (inicio, fim, capacidade_pessoas, ativa) on table public.sessoes to authenticated;
grant delete on table public.sessoes to authenticated;

-- vouchers: leitura só para gestor (pela RLS). Nenhuma escrita direta.
grant select on table public.vouchers to authenticated;

-- limites_requisicao: só as funções (security definer) escrevem; admin pode ler.
grant select on table public.limites_requisicao to authenticated;

-- service_role (D8): emissão pública e token passam por funções; leitura para os testes e scripts.
grant select on table public.atividades, public.sessoes, public.vouchers, public.limites_requisicao to service_role;

alter table public.atividades enable row level security;
alter table public.sessoes enable row level security;
alter table public.vouchers enable row level security;
alter table public.limites_requisicao enable row level security;

-- atividades: público vê as publicadas de municípios ativos; membros veem todas do seu município;
-- gestor cria e altera. Não há exclusão: atividade sai do ar sendo arquivada.
create policy atividades_leitura on public.atividades for select to anon, authenticated
  using (
    (status = 'publicado' and exists (select 1 from public.municipios m where m.id = municipio_id and m.ativo))
    or (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
  );
create policy atividades_inclusao on public.atividades for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy atividades_alteracao on public.atividades for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));

-- sessoes: público vê as ativas de atividades publicadas; membros veem todas; gestor grava.
-- Exclusão só sem reservas (a FK dos vouchers também impede).
create policy sessoes_leitura on public.sessoes for select to anon, authenticated
  using (
    (ativa and exists (
      select 1 from public.atividades a join public.municipios m on m.id = a.municipio_id
      where a.municipio_id = sessoes.municipio_id and a.id = sessoes.atividade_id
        and a.status = 'publicado' and m.ativo))
    or (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
  );
create policy sessoes_inclusao on public.sessoes for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy sessoes_alteracao on public.sessoes for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy sessoes_exclusao on public.sessoes for delete to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])) and pessoas_reservadas = 0);

-- vouchers: só gestor do município (e admin) lê a tabela. Operador usa conferir_voucher.
create policy vouchers_leitura on public.vouchers for select to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));

-- limites_requisicao: só o admin da assessoria lê (diagnóstico de abuso).
create policy limites_leitura on public.limites_requisicao for select to authenticated
  using ((select privado.eh_admin()));
