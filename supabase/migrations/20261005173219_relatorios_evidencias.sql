-- Fase 3: relatórios completos, evidências com histórico e minuta do relatório de implantação.
--
-- Regras (SPEC 6, CLAUDE.md):
--   * Relatórios e evidências são do gestor do município (e do admin). Operador e anônimo não leem.
--   * Evidência: data de realização (informada) separada da data de inclusão (automática),
--     autoria preservada e histórico de alterações preenchido só por trigger.
--   * Arquivos de evidência (fotos, listas de presença, atas, outros) ficam no bucket interno,
--     na pasta "<municipio_id>/evidencias/", já protegida pelas políticas da Fase 2.
--   * Atividade pode indicar o prestador que a conduz (FK composta), para o relatório listar
--     os prestadores envolvidos.

-- ---------------------------------------------------------------------------
-- Prestador responsável pela atividade (opcional, mesmo município)
-- ---------------------------------------------------------------------------

alter table public.atividades
  add column prestador_id uuid,
  add constraint atividades_prestador_fk foreign key (municipio_id, prestador_id)
    references public.prestadores (municipio_id, id);

comment on column public.atividades.prestador_id is 'Prestador da rede que conduz a atividade (opcional, mesmo município).';

grant insert (prestador_id), update (prestador_id) on table public.atividades to authenticated;

-- ---------------------------------------------------------------------------
-- evidencias
-- ---------------------------------------------------------------------------

create table public.evidencias (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  ano_base integer not null check (ano_base between 2020 and 2100),
  tipo_acao text not null check (tipo_acao in (
    'reuniao', 'capacitacao', 'divulgacao', 'evento', 'melhoria_atrativo', 'monitoramento', 'outro')),
  titulo text not null check (length(trim(titulo)) between 3 and 160),
  descricao text not null check (length(trim(descricao)) between 10 and 4000),
  data_realizacao date not null check (data_realizacao >= date '2015-01-01'),
  responsavel text not null check (length(trim(responsavel)) between 2 and 160),
  atividade_id uuid,
  arquivada boolean not null default false,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_por uuid,
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, id),
  foreign key (municipio_id, atividade_id) references public.atividades (municipio_id, id)
);

comment on table public.evidencias is 'Evidências de ações de turismo. Privadas do município (gestor e admin).';
comment on column public.evidencias.data_realizacao is 'Data em que a ação aconteceu (informada pelo gestor).';
comment on column public.evidencias.criado_em is 'Data de inclusão no sistema (automática).';

create index evidencias_municipio_ano_idx on public.evidencias (municipio_id, ano_base, data_realizacao desc);

create table public.evidencias_arquivos (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null,
  evidencia_id uuid not null,
  tipo text not null check (tipo in ('foto', 'lista_presenca', 'ata', 'outro')),
  caminho text not null unique,
  legenda text not null check (length(trim(legenda)) between 3 and 200),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'application/pdf')),
  tamanho integer not null check (tamanho between 1 and 10485760),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  foreign key (municipio_id, evidencia_id) references public.evidencias (municipio_id, id) on delete cascade,
  check (privado.caminho_do_municipio(caminho, municipio_id) and caminho like '%/evidencias/%'),
  check (tipo <> 'foto' or mime in ('image/jpeg', 'image/png'))
);

comment on table public.evidencias_arquivos is 'Fotos com legenda e anexos (listas de presença, atas, outros) no bucket interno.';

create index evidencias_arquivos_idx on public.evidencias_arquivos (municipio_id, evidencia_id);

create table public.evidencias_historico (
  id bigint generated always as identity primary key,
  municipio_id uuid not null,
  evidencia_id uuid not null,
  em timestamptz not null default now(),
  autor_id uuid,
  autor_nome text,
  acao text not null check (acao in (
    'criada', 'editada', 'arquivada', 'reativada', 'arquivo_incluido', 'arquivo_removido', 'legenda_alterada')),
  campos text[] not null default '{}',
  antes jsonb,
  depois jsonb
);

comment on table public.evidencias_historico is 'Histórico de alterações das evidências, com autor e horário. Só trigger grava.';

create index evidencias_historico_idx on public.evidencias_historico (municipio_id, evidencia_id, em desc);

-- ---------------------------------------------------------------------------
-- Minuta do relatório de implantação: seções editáveis por município e ano-base
-- ---------------------------------------------------------------------------

create table public.minutas_relatorio (
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  ano_base integer not null check (ano_base between 2020 and 2100),
  metodologia text check (metodologia is null or length(metodologia) <= 8000),
  limitacoes text check (limitacoes is null or length(limitacoes) <= 8000),
  analise text check (analise is null or length(analise) <= 8000),
  recomendacoes text check (recomendacoes is null or length(recomendacoes) <= 8000),
  atualizado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (municipio_id, ano_base)
);

comment on table public.minutas_relatorio is 'Textos do responsável (metodologia, limitações, análise, recomendações) da minuta por ano-base.';

-- ---------------------------------------------------------------------------
-- Triggers: datas, autoria e histórico
-- ---------------------------------------------------------------------------

-- Antes de gravar a evidência: recusa data de realização futura (fuso America/Araguaina),
-- registra quem alterou e impede trocar a autoria e a data de inclusão.
create function privado.preparar_evidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.data_realizacao > privado.hoje_local() then
    perform privado.erro('data_futura');
  end if;
  if tg_op = 'UPDATE' then
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    new.atualizado_por := (select auth.uid());
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger evidencias_preparar before insert or update on public.evidencias
  for each row execute function privado.preparar_evidencia();

create function privado.preparar_minuta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_por := (select auth.uid());
  if tg_op = 'UPDATE' then
    new.criado_em := old.criado_em;
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger minutas_preparar before insert or update on public.minutas_relatorio
  for each row execute function privado.preparar_minuta();

-- Nome do autor guardado no histórico (o gestor não lê perfis de outras pessoas).
create function privado.nome_do_autor(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(p.nome), ''), u.email)
  from auth.users u left join public.perfis p on p.user_id = u.id
  where u.id = p_user_id;
$$;

create function privado.historico_evidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
  v_velho jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_novo jsonb := to_jsonb(new);
  v_campos text[] := '{}';
  v_antes jsonb := '{}';
  v_depois jsonb := '{}';
  v_acao text;
  c text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criada';
    v_antes := null;
    v_depois := v_novo - array['criado_por', 'criado_em', 'atualizado_por', 'atualizado_em'];
  else
    foreach c in array array['ano_base', 'tipo_acao', 'titulo', 'descricao', 'data_realizacao', 'responsavel',
                             'atividade_id', 'arquivada'] loop
      if (v_velho -> c) is distinct from (v_novo -> c) then
        v_campos := v_campos || c;
        v_antes := v_antes || jsonb_build_object(c, v_velho -> c);
        v_depois := v_depois || jsonb_build_object(c, v_novo -> c);
      end if;
    end loop;
    if cardinality(v_campos) = 0 then
      return null;
    end if;
    v_acao := case
      when v_campos = array['arquivada'] and new.arquivada then 'arquivada'
      when v_campos = array['arquivada'] then 'reativada'
      else 'editada'
    end;
  end if;
  insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, campos, antes, depois)
  values (new.municipio_id, new.id, v_autor, privado.nome_do_autor(v_autor), v_acao, v_campos, v_antes, v_depois);
  return null;
end;
$$;

create trigger evidencias_historico after insert or update on public.evidencias
  for each row execute function privado.historico_evidencia();

create function privado.historico_arquivo_evidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, depois)
    values (new.municipio_id, new.evidencia_id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_incluido',
            jsonb_build_object('tipo', new.tipo, 'legenda', new.legenda));
    return null;
  elsif tg_op = 'DELETE' then
    insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, antes)
    values (old.municipio_id, old.evidencia_id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_removido',
            jsonb_build_object('tipo', old.tipo, 'legenda', old.legenda));
    return null;
  end if;
  if old.legenda is not distinct from new.legenda then
    return null;
  end if;
  insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, campos, antes, depois)
  values (new.municipio_id, new.evidencia_id, v_autor, privado.nome_do_autor(v_autor), 'legenda_alterada',
          array['legenda'], jsonb_build_object('legenda', old.legenda), jsonb_build_object('legenda', new.legenda));
  return null;
end;
$$;

create trigger evidencias_arquivos_historico after insert or update or delete on public.evidencias_arquivos
  for each row execute function privado.historico_arquivo_evidencia();

create trigger auditoria_evidencias after insert or update or delete on public.evidencias
  for each row execute function privado.registrar_auditoria('municipio_id');
create trigger auditoria_evidencias_arquivos after insert or update or delete on public.evidencias_arquivos
  for each row execute function privado.registrar_auditoria('municipio_id');
create trigger auditoria_minutas after insert or update or delete on public.minutas_relatorio
  for each row execute function privado.registrar_auditoria('municipio_id');

revoke all on function privado.preparar_evidencia(), privado.preparar_minuta(), privado.nome_do_autor(uuid),
  privado.historico_evidencia(), privado.historico_arquivo_evidencia() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Relatório completo do período (item 3.1): números dos vouchers (Fase 1) mais origem
-- por cidade e UF, prestadores envolvidos e rede. Gestor do município ou admin.
-- ---------------------------------------------------------------------------

create function privado.relatorio_completo(p_municipio_id uuid, p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
begin
  -- Confere papel e período (erros sem_permissao e periodo_invalido).
  v_base := privado.relatorio_vouchers(p_municipio_id, p_inicio, p_fim);
  return v_base || jsonb_build_object(
    -- Origem declarada nos vouchers e registros não cancelados.
    'origem', coalesce((
      select jsonb_agg(x order by (x ->> 'vouchers')::int desc, x ->> 'uf', x ->> 'cidade')
      from (
        select jsonb_build_object(
          'uf', vo.uf,
          'cidade', vo.cidade,
          'vouchers', count(*),
          'pessoas', sum(vo.pessoas),
          'participacoes_confirmadas', coalesce(sum(vo.pessoas_atendidas) filter (where vo.status = 'utilizado'), 0)
        ) as x
        from public.vouchers vo
        where vo.municipio_id = p_municipio_id and vo.data_visita between p_inicio and p_fim and vo.status <> 'cancelado'
        group by vo.uf, vo.cidade
      ) t), '[]'::jsonb),
    -- Prestadores que conduzem atividades com vouchers no período.
    'prestadores', coalesce((
      select jsonb_agg(x order by x ->> 'nome')
      from (
        select jsonb_build_object(
          'nome', p.nome_publico,
          'categoria', p.categoria,
          'situacao_rede', p.situacao_rede,
          'atividades', count(distinct a.id),
          'vouchers', count(vo.id) filter (where vo.status <> 'cancelado'),
          'participacoes_confirmadas', coalesce(sum(vo.pessoas_atendidas) filter (where vo.status = 'utilizado'), 0)
        ) as x
        from public.prestadores p
        join public.atividades a on a.municipio_id = p.municipio_id and a.prestador_id = p.id
        join public.vouchers vo on vo.municipio_id = a.municipio_id and vo.atividade_id = a.id
          and vo.data_visita between p_inicio and p_fim
        where p.municipio_id = p_municipio_id
        group by p.id, p.nome_publico, p.categoria, p.situacao_rede
      ) t), '[]'::jsonb),
    -- Rede de prestadores: participantes hoje e adesões registradas no período (só o nome público).
    'rede', jsonb_build_object(
      'participantes', (select count(*) from public.prestadores p
                        where p.municipio_id = p_municipio_id and p.situacao_rede = 'participante'),
      'adesoes', coalesce((
        select jsonb_agg(jsonb_build_object('nome', p.nome_publico, 'categoria', p.categoria, 'data_adesao', ad.data_adesao)
                         order by ad.data_adesao, p.nome_publico)
        from public.adesoes_prestador ad
        join public.prestadores p on p.municipio_id = ad.municipio_id and p.id = ad.prestador_id
        where ad.municipio_id = p_municipio_id and ad.data_adesao between p_inicio and p_fim), '[]'::jsonb)
    )
  );
end;
$$;

create function public.relatorio_completo(p_municipio_id uuid, p_inicio date, p_fim date)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select privado.relatorio_completo(p_municipio_id, p_inicio, p_fim); $$;

revoke all on function privado.relatorio_completo(uuid, date, date), public.relatorio_completo(uuid, date, date)
  from public, anon, authenticated, service_role;
grant execute on function privado.relatorio_completo(uuid, date, date), public.relatorio_completo(uuid, date, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos) e RLS
-- ---------------------------------------------------------------------------

revoke all on table public.evidencias, public.evidencias_arquivos, public.evidencias_historico, public.minutas_relatorio
  from anon, authenticated, service_role;

grant select on table public.evidencias to authenticated;
grant insert (municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel, atividade_id)
  on table public.evidencias to authenticated;
grant update (ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel, atividade_id, arquivada)
  on table public.evidencias to authenticated;

grant select, delete on table public.evidencias_arquivos to authenticated;
grant insert (municipio_id, evidencia_id, tipo, caminho, legenda, mime, tamanho) on table public.evidencias_arquivos to authenticated;
grant update (legenda) on table public.evidencias_arquivos to authenticated;

grant select on table public.evidencias_historico to authenticated;

grant select on table public.minutas_relatorio to authenticated;
grant insert (municipio_id, ano_base, metodologia, limitacoes, analise, recomendacoes) on table public.minutas_relatorio to authenticated;
grant update (metodologia, limitacoes, analise, recomendacoes) on table public.minutas_relatorio to authenticated;

grant select on table public.evidencias, public.evidencias_arquivos, public.evidencias_historico, public.minutas_relatorio
  to service_role;

alter table public.evidencias enable row level security;
alter table public.evidencias_arquivos enable row level security;
alter table public.evidencias_historico enable row level security;
alter table public.minutas_relatorio enable row level security;

-- Tudo só para o gestor do município (e o admin). Sem exclusão de evidência: ela é arquivada.
create policy evidencias_leitura on public.evidencias for select to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy evidencias_inclusao on public.evidencias for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy evidencias_alteracao on public.evidencias for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));

create policy evidencias_arquivos_leitura on public.evidencias_arquivos for select to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy evidencias_arquivos_inclusao on public.evidencias_arquivos for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy evidencias_arquivos_alteracao on public.evidencias_arquivos for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy evidencias_arquivos_exclusao on public.evidencias_arquivos for delete to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));

create policy evidencias_historico_leitura on public.evidencias_historico for select to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));

create policy minutas_leitura on public.minutas_relatorio for select to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy minutas_inclusao on public.minutas_relatorio for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy minutas_alteracao on public.minutas_relatorio for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
