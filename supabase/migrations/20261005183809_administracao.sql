-- Fase 4: administração, equipe, auditoria e exclusão de arquivo de evidência a pedido do titular (LGPD).
--
-- Regras (CLAUDE.md, SPEC 3):
--   * Ninguém altera o próprio perfil administrativo nem os próprios vínculos.
--   * Gestor gerencia a equipe (gestores e operadores) só do município em que é gestor; o admin, de todos.
--     Nenhum dos dois cria vínculo para si. Promover a admin continua só para outro admin (trigger da Fase 0).
--   * Vínculo não muda de usuário nem de município: só papel e situação (ativo) são alteráveis.
--   * Arquivo de evidência: o gestor só retira o arquivo da evidência (fica guardado); apagar de vez,
--     no banco e no Storage, é só do admin da assessoria, com motivo registrado no histórico.

-- ---------------------------------------------------------------------------
-- Vínculos: gestor gerencia a equipe do próprio município
-- ---------------------------------------------------------------------------

revoke insert, update on table public.vinculos from authenticated;
grant insert (user_id, municipio_id, papel) on table public.vinculos to authenticated;
grant update (papel, ativo) on table public.vinculos to authenticated;

drop policy vinculos_inclusao on public.vinculos;
drop policy vinculos_alteracao on public.vinculos;

create policy vinculos_inclusao on public.vinculos for insert to authenticated
  with check (user_id <> (select auth.uid()) and (select privado.tem_papel(municipio_id, array['gestor'])));
create policy vinculos_alteracao on public.vinculos for update to authenticated
  using (user_id <> (select auth.uid()) and (select privado.tem_papel(municipio_id, array['gestor'])))
  with check (user_id <> (select auth.uid()) and (select privado.tem_papel(municipio_id, array['gestor'])));
-- vinculos_exclusao continua só do admin: o caminho normal é desativar.

-- ---------------------------------------------------------------------------
-- Equipe do município (gestor ou admin): nome, e-mail, papel e situação
-- ---------------------------------------------------------------------------

create function privado.equipe_do_municipio(p_municipio_id uuid)
returns table (
  vinculo_id uuid, user_id uuid, nome text, email text, papel text, ativo boolean,
  convite_pendente boolean, criado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.tem_papel(p_municipio_id, array['gestor']) then
    perform privado.erro('sem_permissao');
  end if;
  return query
    select v.id, v.user_id, nullif(trim(p.nome), ''), u.email::text, v.papel, v.ativo,
           u.last_sign_in_at is null, v.criado_em
    from public.vinculos v
    join public.perfis p on p.user_id = v.user_id
    join auth.users u on u.id = v.user_id
    where v.municipio_id = p_municipio_id
    order by v.ativo desc, v.papel, coalesce(nullif(trim(p.nome), ''), u.email);
end;
$$;

create function public.equipe_do_municipio(p_municipio_id uuid)
returns table (
  vinculo_id uuid, user_id uuid, nome text, email text, papel text, ativo boolean,
  convite_pendente boolean, criado_em timestamptz
)
language sql stable security invoker set search_path = ''
as $$ select * from privado.equipe_do_municipio(p_municipio_id); $$;

-- Conta pelo e-mail. Usada pelo servidor no convite (service_role, D8.4) e pelo admin ao conceder
-- acesso de administrador. Ninguém mais descobre quem tem conta.
create function privado.usuario_por_email(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (privado.eh_admin() or coalesce((select auth.role()), '') = 'service_role') then
    perform privado.erro('sem_permissao');
  end if;
  return (select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1);
end;
$$;

create function public.usuario_por_email(p_email text)
returns uuid language sql stable security invoker set search_path = ''
as $$ select privado.usuario_por_email(p_email); $$;

-- Administradores da assessoria (só o admin vê a lista).
create function privado.admins_assessoria()
returns table (user_id uuid, nome text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.eh_admin() then
    perform privado.erro('sem_permissao');
  end if;
  return query
    select p.user_id, nullif(trim(p.nome), ''), u.email::text
    from public.perfis p join auth.users u on u.id = p.user_id
    where p.admin_assessoria
    order by u.email;
end;
$$;

create function public.admins_assessoria()
returns table (user_id uuid, nome text, email text)
language sql stable security invoker set search_path = ''
as $$ select * from privado.admins_assessoria(); $$;

-- ---------------------------------------------------------------------------
-- Auditoria com filtros (item 4.4): município, usuário, período e tipo de ação
-- ---------------------------------------------------------------------------

-- Sem município: só o admin (todos os municípios e registros sem município). Com município: gestor dele.
-- Devolve os campos alterados, não os valores (que podem ter dados pessoais).
create function privado.auditoria_consultar(
  p_municipio_id uuid, p_usuario_id uuid, p_inicio date, p_fim date,
  p_tabela text, p_operacao text, p_antes_de bigint, p_limite integer
)
returns table (
  id bigint, em timestamptz, usuario_id uuid, usuario_nome text, municipio_id uuid, municipio_nome text,
  tabela text, operacao text, registro_id text, campos text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_municipio_id is null and not privado.eh_admin() then
    perform privado.erro('sem_permissao');
  end if;
  if p_municipio_id is not null and not privado.tem_papel(p_municipio_id, array['gestor']) then
    perform privado.erro('sem_permissao');
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    perform privado.erro('periodo_invalido');
  end if;
  return query
    select a.id, a.em, a.usuario_id, privado.nome_do_autor(a.usuario_id), a.municipio_id, m.nome,
           a.tabela, a.operacao, a.registro_id,
           case when a.operacao = 'UPDATE' then array(
             select k from jsonb_object_keys(a.depois) k
             where k not in ('atualizado_em', 'atualizado_por') and (a.antes -> k) is distinct from (a.depois -> k)
             order by k)
           else '{}'::text[] end
    from public.auditoria a
    left join public.municipios m on m.id = a.municipio_id
    where (p_municipio_id is null or a.municipio_id = p_municipio_id)
      and (p_usuario_id is null or a.usuario_id = p_usuario_id)
      and a.em >= (p_inicio::timestamp at time zone 'America/Araguaina')
      and a.em < ((p_fim + 1)::timestamp at time zone 'America/Araguaina')
      and (p_tabela is null or a.tabela = p_tabela)
      and (p_operacao is null or a.operacao = p_operacao)
      and (p_antes_de is null or a.id < p_antes_de)
    order by a.id desc
    limit least(greatest(coalesce(p_limite, 50), 1), 200);
end;
$$;

create function public.auditoria_consultar(
  p_municipio_id uuid, p_usuario_id uuid, p_inicio date, p_fim date,
  p_tabela text, p_operacao text, p_antes_de bigint, p_limite integer
)
returns table (
  id bigint, em timestamptz, usuario_id uuid, usuario_nome text, municipio_id uuid, municipio_nome text,
  tabela text, operacao text, registro_id text, campos text[]
)
language sql stable security invoker set search_path = ''
as $$
  select * from privado.auditoria_consultar(p_municipio_id, p_usuario_id, p_inicio, p_fim, p_tabela, p_operacao, p_antes_de, p_limite);
$$;

-- Pessoas que aparecem na auditoria visível (para o filtro por usuário).
create function privado.auditoria_usuarios(p_municipio_id uuid)
returns table (usuario_id uuid, nome text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_municipio_id is null and not privado.eh_admin() then
    perform privado.erro('sem_permissao');
  end if;
  if p_municipio_id is not null and not privado.tem_papel(p_municipio_id, array['gestor']) then
    perform privado.erro('sem_permissao');
  end if;
  return query
    select x.usuario_id, privado.nome_do_autor(x.usuario_id)
    from (select distinct a.usuario_id from public.auditoria a
          where a.usuario_id is not null and (p_municipio_id is null or a.municipio_id = p_municipio_id)) x
    order by 2;
end;
$$;

create function public.auditoria_usuarios(p_municipio_id uuid)
returns table (usuario_id uuid, nome text)
language sql stable security invoker set search_path = ''
as $$ select * from privado.auditoria_usuarios(p_municipio_id); $$;

-- ---------------------------------------------------------------------------
-- Arquivos de evidência: gestor retira; só o admin exclui de vez (LGPD)
-- ---------------------------------------------------------------------------

alter table public.evidencias_arquivos
  add column retirado boolean not null default false,
  add column retirado_em timestamptz,
  add column retirado_por uuid;

comment on column public.evidencias_arquivos.retirado is
  'Retirado da evidência pelo gestor: sai da tela e da minuta, mas o arquivo continua guardado.';

revoke delete on table public.evidencias_arquivos from authenticated;
grant update (retirado) on table public.evidencias_arquivos to authenticated;
drop policy evidencias_arquivos_exclusao on public.evidencias_arquivos;

alter table public.evidencias_historico drop constraint evidencias_historico_acao_check;
alter table public.evidencias_historico add constraint evidencias_historico_acao_check check (acao in (
  'criada', 'editada', 'arquivada', 'reativada', 'arquivo_incluido', 'arquivo_removido', 'legenda_alterada',
  'arquivo_excluido_lgpd'));

create function privado.preparar_arquivo_evidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.retirado and not new.retirado then
    raise exception 'Arquivo retirado não volta para a evidência. Envie o arquivo de novo.' using errcode = '42501';
  end if;
  if new.retirado and not old.retirado then
    new.retirado_em := now();
    new.retirado_por := (select auth.uid());
  else
    new.retirado_em := old.retirado_em;
    new.retirado_por := old.retirado_por;
  end if;
  return new;
end;
$$;

create trigger evidencias_arquivos_preparar before update on public.evidencias_arquivos
  for each row execute function privado.preparar_arquivo_evidencia();

-- Histórico de arquivos: retirar conta como remoção; a exclusão LGPD é registrada pela própria função.
create or replace function privado.historico_arquivo_evidencia()
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
    if coalesce(current_setting('turismo.exclusao_lgpd', true), '') = 'sim' then
      return null;
    end if;
    insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, antes)
    values (old.municipio_id, old.evidencia_id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_removido',
            jsonb_build_object('tipo', old.tipo, 'legenda', old.legenda));
    return null;
  end if;
  if new.retirado and not old.retirado then
    insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, antes)
    values (new.municipio_id, new.evidencia_id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_removido',
            jsonb_build_object('tipo', old.tipo, 'legenda', old.legenda));
  end if;
  if old.legenda is distinct from new.legenda then
    insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, campos, antes, depois)
    values (new.municipio_id, new.evidencia_id, v_autor, privado.nome_do_autor(v_autor), 'legenda_alterada',
            array['legenda'], jsonb_build_object('legenda', old.legenda), jsonb_build_object('legenda', new.legenda));
  end if;
  return null;
end;
$$;

-- Exclusão definitiva a pedido do titular. O servidor apaga o objeto do Storage com a sessão do admin
-- ANTES de chamar esta função; ela confere que o objeto não existe mais, registra quem, quando e o motivo
-- (sem legenda e sem cópia do arquivo) e apaga a linha.
create function privado.excluir_arquivo_evidencia_lgpd(p_arquivo_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.evidencias_arquivos%rowtype;
  v_autor uuid := (select auth.uid());
begin
  if not privado.eh_admin() then
    perform privado.erro('sem_permissao');
  end if;
  if p_motivo is null or length(trim(p_motivo)) not between 10 and 500 then
    perform privado.erro('motivo_invalido');
  end if;
  select * into v from public.evidencias_arquivos a where a.id = p_arquivo_id for update;
  if not found then
    perform privado.erro('arquivo_inexistente');
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'interno' and o.name = v.caminho) then
    perform privado.erro('arquivo_ainda_no_storage');
  end if;
  insert into public.evidencias_historico (municipio_id, evidencia_id, autor_id, autor_nome, acao, antes, depois)
  values (v.municipio_id, v.evidencia_id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_excluido_lgpd',
          jsonb_build_object('tipo', v.tipo), jsonb_build_object('motivo', trim(p_motivo)));
  perform set_config('turismo.exclusao_lgpd', 'sim', true);
  delete from public.evidencias_arquivos a where a.id = p_arquivo_id;
  perform set_config('turismo.exclusao_lgpd', '', true);
end;
$$;

create function public.excluir_arquivo_evidencia_lgpd(p_arquivo_id uuid, p_motivo text)
returns void language sql security invoker set search_path = ''
as $$ select privado.excluir_arquivo_evidencia_lgpd(p_arquivo_id, p_motivo); $$;

-- Objeto do Storage ainda ligado a um arquivo de evidência (o gestor não apaga nem sobrescreve).
create function privado.arquivo_de_evidencia_em_uso(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.evidencias_arquivos a where a.caminho = p_nome);
$$;

drop policy interno_gestor_exclusao on storage.objects;
drop policy interno_gestor_alteracao on storage.objects;

create policy interno_gestor_alteracao on storage.objects for update to authenticated
  using (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor']))
         and ((select privado.eh_admin()) or not privado.arquivo_de_evidencia_em_uso(name)))
  with check (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor']))
              and ((select privado.eh_admin()) or not privado.arquivo_de_evidencia_em_uso(name)));
create policy interno_gestor_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor']))
         and ((select privado.eh_admin()) or not privado.arquivo_de_evidencia_em_uso(name)));

-- ---------------------------------------------------------------------------
-- Privilégios das funções
-- ---------------------------------------------------------------------------

revoke all on function
  privado.equipe_do_municipio(uuid), public.equipe_do_municipio(uuid),
  privado.usuario_por_email(text), public.usuario_por_email(text),
  privado.admins_assessoria(), public.admins_assessoria(),
  privado.auditoria_consultar(uuid, uuid, date, date, text, text, bigint, integer),
  public.auditoria_consultar(uuid, uuid, date, date, text, text, bigint, integer),
  privado.auditoria_usuarios(uuid), public.auditoria_usuarios(uuid),
  privado.excluir_arquivo_evidencia_lgpd(uuid, text), public.excluir_arquivo_evidencia_lgpd(uuid, text),
  privado.preparar_arquivo_evidencia(), privado.arquivo_de_evidencia_em_uso(text)
from public, anon, authenticated, service_role;

grant execute on function
  privado.equipe_do_municipio(uuid), public.equipe_do_municipio(uuid),
  privado.admins_assessoria(), public.admins_assessoria(),
  privado.auditoria_consultar(uuid, uuid, date, date, text, text, bigint, integer),
  public.auditoria_consultar(uuid, uuid, date, date, text, text, bigint, integer),
  privado.auditoria_usuarios(uuid), public.auditoria_usuarios(uuid),
  privado.excluir_arquivo_evidencia_lgpd(uuid, text), public.excluir_arquivo_evidencia_lgpd(uuid, text),
  privado.arquivo_de_evidencia_em_uso(text)
to authenticated;

grant execute on function privado.usuario_por_email(text), public.usuario_por_email(text) to authenticated, service_role;
