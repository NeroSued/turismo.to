-- Fase 5.9: na exclusão a pedido do titular (LGPD), a legenda do arquivo (que pode ter o nome da pessoa)
-- é substituída por "[removido a pedido do titular]" em todos os registros do histórico da evidência
-- e da auditoria que se referem a esse arquivo. Quem removeu, quando, o tipo e o motivo continuam.

alter table public.evidencias_historico add column arquivo_id uuid;

comment on column public.evidencias_historico.arquivo_id is
  'Arquivo de evidência a que o registro se refere (inclusão, legenda, retirada, exclusão LGPD). Sem FK: o arquivo pode ter sido excluído.';

create index evidencias_historico_arquivo_idx on public.evidencias_historico (arquivo_id) where arquivo_id is not null;

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
    insert into public.evidencias_historico (municipio_id, evidencia_id, arquivo_id, autor_id, autor_nome, acao, depois)
    values (new.municipio_id, new.evidencia_id, new.id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_incluido',
            jsonb_build_object('tipo', new.tipo, 'legenda', new.legenda));
    return null;
  elsif tg_op = 'DELETE' then
    if coalesce(current_setting('turismo.exclusao_lgpd', true), '') = 'sim' then
      return null;
    end if;
    insert into public.evidencias_historico (municipio_id, evidencia_id, arquivo_id, autor_id, autor_nome, acao, antes)
    values (old.municipio_id, old.evidencia_id, old.id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_removido',
            jsonb_build_object('tipo', old.tipo, 'legenda', old.legenda));
    return null;
  end if;
  if new.retirado and not old.retirado then
    insert into public.evidencias_historico (municipio_id, evidencia_id, arquivo_id, autor_id, autor_nome, acao, antes)
    values (new.municipio_id, new.evidencia_id, new.id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_removido',
            jsonb_build_object('tipo', old.tipo, 'legenda', old.legenda));
  end if;
  if old.legenda is distinct from new.legenda then
    insert into public.evidencias_historico (municipio_id, evidencia_id, arquivo_id, autor_id, autor_nome, acao, campos, antes, depois)
    values (new.municipio_id, new.evidencia_id, new.id, v_autor, privado.nome_do_autor(v_autor), 'legenda_alterada',
            array['legenda'], jsonb_build_object('legenda', old.legenda), jsonb_build_object('legenda', new.legenda));
  end if;
  return null;
end;
$$;

-- Troca a chave "legenda" de um jsonb, se existir.
create function privado.sem_legenda(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p ? 'legenda' then jsonb_set(p, '{legenda}', to_jsonb('[removido a pedido do titular]'::text)) else p end;
$$;

revoke all on function privado.sem_legenda(jsonb) from public;

create or replace function privado.excluir_arquivo_evidencia_lgpd(p_arquivo_id uuid, p_motivo text)
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
  insert into public.evidencias_historico (municipio_id, evidencia_id, arquivo_id, autor_id, autor_nome, acao, antes, depois)
  values (v.municipio_id, v.evidencia_id, v.id, v_autor, privado.nome_do_autor(v_autor), 'arquivo_excluido_lgpd',
          jsonb_build_object('tipo', v.tipo), jsonb_build_object('motivo', trim(p_motivo)));
  perform set_config('turismo.exclusao_lgpd', 'sim', true);
  delete from public.evidencias_arquivos a where a.id = p_arquivo_id;
  perform set_config('turismo.exclusao_lgpd', '', true);

  -- Legenda fora dos registros anteriores do histórico: pelo arquivo_id e, nos registros gravados antes
  -- da coluna existir, pela evidência e pelo texto exato da legenda.
  update public.evidencias_historico h
  set antes = privado.sem_legenda(h.antes), depois = privado.sem_legenda(h.depois)
  where h.municipio_id = v.municipio_id and h.evidencia_id = v.evidencia_id
    and (h.arquivo_id = v.id
         or (h.arquivo_id is null and (h.antes ->> 'legenda' = v.legenda or h.depois ->> 'legenda' = v.legenda)));

  -- O mesmo na auditoria do arquivo, inclusive no registro da exclusão gravado agora pelo trigger.
  update public.auditoria a
  set antes = privado.sem_legenda(a.antes), depois = privado.sem_legenda(a.depois)
  where a.tabela = 'evidencias_arquivos' and a.registro_id = v.id::text;
end;
$$;
