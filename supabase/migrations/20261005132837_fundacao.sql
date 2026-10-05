-- Fase 0: municípios, configurações, perfis, vínculos, auditoria e funções de autorização.
--
-- Regras (CLAUDE.md):
--   * RLS em todas as tabelas de public, com políticas explícitas.
--   * Autorização lida de perfis e vinculos por funções security definer com search_path = ''.
--   * Ninguém altera o próprio perfil administrativo nem os próprios vínculos.
--   * Tabelas novas não são expostas automaticamente à Data API: os GRANTs abaixo são explícitos.

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create function privado.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.municipios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]{2,40}$'),
  nome text not null check (length(trim(nome)) between 2 and 120),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.municipios is 'Municípios atendidos. O slug é o subdomínio do portal.';

create table public.configuracoes_municipio (
  municipio_id uuid primary key references public.municipios (id) on delete cascade,
  nome_exibicao text check (nome_exibicao is null or length(trim(nome_exibicao)) between 2 and 120),
  cor_primaria text not null default '#1F4D3A' check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  logo_caminho text,
  contato_secretaria text,
  ouvidoria_url text check (ouvidoria_url is null or ouvidoria_url ~ '^https://'),
  aviso_privacidade text,
  referencia_icms text not null default 'item 6.1.4',
  dias_anonimizacao integer not null default 90 check (dias_anonimizacao between 1 and 3650),
  atualizado_em timestamptz not null default now()
);

comment on table public.configuracoes_municipio is 'Configurações públicas de cada portal municipal (uma linha por município).';

create table public.perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text check (nome is null or length(trim(nome)) between 1 and 120),
  admin_assessoria boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column public.perfis.admin_assessoria is 'Administrador da assessoria. Só outro administrador altera.';

create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis (user_id) on delete cascade,
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  papel text not null check (papel in ('gestor', 'operador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, municipio_id),
  unique (municipio_id, id)
);

create index vinculos_municipio_idx on public.vinculos (municipio_id);

create table public.auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  usuario_id uuid,
  municipio_id uuid,
  tabela text not null,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id text,
  antes jsonb,
  depois jsonb
);

create index auditoria_municipio_em_idx on public.auditoria (municipio_id, em desc);
create index auditoria_usuario_em_idx on public.auditoria (usuario_id, em desc);

comment on table public.auditoria is 'Quem, quando e o quê. Preenchida apenas por trigger; ninguém grava diretamente.';

create trigger municipios_atualizado_em before update on public.municipios
  for each row execute function privado.tocar_atualizado_em();
create trigger configuracoes_atualizado_em before update on public.configuracoes_municipio
  for each row execute function privado.tocar_atualizado_em();
create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function privado.tocar_atualizado_em();
create trigger vinculos_atualizado_em before update on public.vinculos
  for each row execute function privado.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Funções de autorização (leem perfis e vinculos, nunca metadados do usuário)
-- ---------------------------------------------------------------------------

create function privado.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = (select auth.uid()) and p.admin_assessoria
  );
$$;

comment on function privado.eh_admin() is 'O usuário da sessão é administrador da assessoria.';

create function privado.tem_papel(p_municipio_id uuid, p_papeis text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.eh_admin() or exists (
    select 1
    from public.vinculos v
    where v.user_id = (select auth.uid())
      and v.municipio_id = p_municipio_id
      and v.ativo
      and v.papel = any (p_papeis)
  );
$$;

comment on function privado.tem_papel(uuid, text[]) is 'O usuário da sessão tem um dos papéis no município (o admin da assessoria passa sempre).';

revoke all on function privado.eh_admin() from public;
revoke all on function privado.tem_papel(uuid, text[]) from public;
grant execute on function privado.eh_admin() to anon, authenticated;
grant execute on function privado.tem_papel(uuid, text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Perfil criado para todo usuário do Auth; configuração criada para todo município
-- ---------------------------------------------------------------------------

create function privado.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke all on function privado.criar_perfil() from public;

create trigger criar_perfil_apos_cadastro after insert on auth.users
  for each row execute function privado.criar_perfil();

create function privado.criar_configuracao_municipio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.configuracoes_municipio (municipio_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke all on function privado.criar_configuracao_municipio() from public;

create trigger criar_configuracao after insert on public.municipios
  for each row execute function privado.criar_configuracao_municipio();

-- ---------------------------------------------------------------------------
-- Proteção do perfil administrativo
-- ---------------------------------------------------------------------------

-- RLS decide quem atualiza a linha; este trigger decide quem muda admin_assessoria.
-- Pela API (papéis anon/authenticated), só outro administrador muda o campo.
-- O script criar-admin usa service_role e não passa por esta checagem.
-- security invoker de propósito: current_user precisa ser o papel da sessão.
create function privado.proteger_admin_assessoria()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.admin_assessoria is distinct from old.admin_assessoria
     and current_user in ('anon', 'authenticated')
     and (not privado.eh_admin() or old.user_id = (select auth.uid())) then
    raise exception 'Somente outro administrador da assessoria pode alterar este perfil administrativo.'
      using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'O usuário de um perfil não pode ser trocado.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function privado.proteger_admin_assessoria() from public;

create trigger perfis_proteger_admin before update on public.perfis
  for each row execute function privado.proteger_admin_assessoria();

-- ---------------------------------------------------------------------------
-- Auditoria genérica
-- ---------------------------------------------------------------------------

-- TG_ARGV[0]: nome da coluna que contém o município do registro.
create function privado.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_linha jsonb := coalesce(v_depois, v_antes);
  v_coluna text := tg_argv[0];
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

revoke all on function privado.registrar_auditoria() from public;

create trigger auditoria_municipios after insert or update or delete on public.municipios
  for each row execute function privado.registrar_auditoria('id');
create trigger auditoria_configuracoes after insert or update or delete on public.configuracoes_municipio
  for each row execute function privado.registrar_auditoria('municipio_id');
create trigger auditoria_perfis after insert or update or delete on public.perfis
  for each row execute function privado.registrar_auditoria();
create trigger auditoria_vinculos after insert or update or delete on public.vinculos
  for each row execute function privado.registrar_auditoria('municipio_id');

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos) e RLS
-- ---------------------------------------------------------------------------

revoke all on table public.municipios, public.configuracoes_municipio, public.perfis,
  public.vinculos, public.auditoria from anon, authenticated;

grant select on table public.municipios to anon, authenticated;
grant insert, update, delete on table public.municipios to authenticated;

grant select on table public.configuracoes_municipio to anon, authenticated;
grant update on table public.configuracoes_municipio to authenticated;

grant select on table public.perfis to authenticated;
grant update (nome, admin_assessoria) on table public.perfis to authenticated;

grant select, insert, update, delete on table public.vinculos to authenticated;

grant select on table public.auditoria to authenticated;

-- service_role (somente operações privilegiadas do PLANO, D8). Auditoria segue só leitura.
grant select, insert, update, delete on table public.municipios, public.configuracoes_municipio,
  public.perfis, public.vinculos to service_role;
grant select on table public.auditoria to service_role;

alter table public.municipios enable row level security;
alter table public.configuracoes_municipio enable row level security;
alter table public.perfis enable row level security;
alter table public.vinculos enable row level security;
alter table public.auditoria enable row level security;

-- municipios: público vê os ativos; membros e admin veem o seu mesmo inativo; só admin altera.
create policy municipios_leitura on public.municipios for select to anon, authenticated
  using (ativo or (select privado.tem_papel(id, array['gestor', 'operador'])));
create policy municipios_inclusao on public.municipios for insert to authenticated
  with check ((select privado.eh_admin()));
create policy municipios_alteracao on public.municipios for update to authenticated
  using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy municipios_exclusao on public.municipios for delete to authenticated
  using ((select privado.eh_admin()));

-- configuracoes_municipio: público vê as de municípios ativos; gestor do município e admin alteram.
create policy configuracoes_leitura on public.configuracoes_municipio for select to anon, authenticated
  using (
    exists (select 1 from public.municipios m where m.id = municipio_id and m.ativo)
    or (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
  );
create policy configuracoes_alteracao on public.configuracoes_municipio for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));

-- perfis: cada um vê o seu; admin vê todos. Atualização limitada por coluna e pelo trigger acima.
create policy perfis_leitura on public.perfis for select to authenticated
  using (user_id = (select auth.uid()) or (select privado.eh_admin()));
create policy perfis_alteracao on public.perfis for update to authenticated
  using (user_id = (select auth.uid()) or (select privado.eh_admin()))
  with check (user_id = (select auth.uid()) or (select privado.eh_admin()));

-- vinculos: cada um vê os seus; gestor vê os do seu município; só admin grava, nunca os próprios.
create policy vinculos_leitura on public.vinculos for select to authenticated
  using (user_id = (select auth.uid()) or (select privado.tem_papel(municipio_id, array['gestor'])));
create policy vinculos_inclusao on public.vinculos for insert to authenticated
  with check ((select privado.eh_admin()) and user_id <> (select auth.uid()));
create policy vinculos_alteracao on public.vinculos for update to authenticated
  using ((select privado.eh_admin()) and user_id <> (select auth.uid()))
  with check ((select privado.eh_admin()) and user_id <> (select auth.uid()));
create policy vinculos_exclusao on public.vinculos for delete to authenticated
  using ((select privado.eh_admin()) and user_id <> (select auth.uid()));

-- auditoria: admin vê tudo; gestor vê a do seu município. Sem políticas de escrita.
create policy auditoria_leitura on public.auditoria for select to authenticated
  using ((select privado.eh_admin()) or (municipio_id is not null and (select privado.tem_papel(municipio_id, array['gestor']))));
