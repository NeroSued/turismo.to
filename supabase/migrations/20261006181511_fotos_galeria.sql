-- Fase 7 (itens 7.3, 7.4 e 7.6): capa e galeria de fotos também em atividades, legenda
-- opcional (sem legenda, o portal usa "Foto N de <nome>"), crédito por foto, até 12 fotos por
-- cadastro, reordenação e descrição em prestadores e eventos (até 2000 caracteres).
--
--   * A capa é a foto de menor `ordem`. Novas fotos entram no fim (trigger).
--   * O original enviado pelo celular fica no bucket privado `originais` só até o servidor
--     gerar a versão publicada, sem metadados EXIF (inclusive GPS) e com no máximo 2000 px
--     no lado maior; o original é apagado em seguida.

-- ---------------------------------------------------------------------------
-- 7.6 Descrição
-- ---------------------------------------------------------------------------

alter table public.eventos drop constraint eventos_descricao_check;
alter table public.eventos
  add constraint eventos_descricao_check check (descricao is null or length(descricao) <= 2000);

alter table public.prestadores
  add column descricao text check (descricao is null or length(descricao) <= 2000);

grant insert (descricao), update (descricao) on table public.prestadores to authenticated;

-- ---------------------------------------------------------------------------
-- Fotos de atividades, legenda opcional e crédito
-- ---------------------------------------------------------------------------

alter table public.fotos
  add column atividade_id uuid,
  add column credito text check (credito is null or length(trim(credito)) between 2 and 120),
  add constraint fotos_atividade_fk foreign key (municipio_id, atividade_id)
    references public.atividades (municipio_id, id) on delete cascade;

alter table public.fotos drop constraint fotos_check;
alter table public.fotos
  add constraint fotos_um_dono check (num_nonnulls(atrativo_id, evento_id, prestador_id, atividade_id) = 1);

alter table public.fotos alter column legenda drop not null;
alter table public.fotos drop constraint fotos_legenda_check;
alter table public.fotos
  add constraint fotos_legenda_check check (legenda is null or length(trim(legenda)) between 3 and 200);

comment on column public.fotos.legenda is
  'Legenda e texto alternativo da foto. Opcional: sem ela, o portal usa "Foto N de <nome do cadastro>".';
comment on column public.fotos.ordem is 'Posição na galeria. A menor é a capa.';

create index fotos_atividade_idx on public.fotos (municipio_id, atividade_id) where atividade_id is not null;

grant insert (atividade_id, credito) on table public.fotos to authenticated;
grant update (credito) on table public.fotos to authenticated;

drop policy fotos_leitura on public.fotos;
create policy fotos_leitura on public.fotos for select to anon, authenticated
  using (
    (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
    or (
      exists (select 1 from public.municipios m where m.id = municipio_id and m.ativo)
      and (
        exists (select 1 from public.atrativos a where a.municipio_id = fotos.municipio_id and a.id = fotos.atrativo_id and a.status = 'publicado')
        or exists (select 1 from public.eventos e where e.municipio_id = fotos.municipio_id and e.id = fotos.evento_id and e.status = 'publicado')
        or exists (select 1 from public.prestadores p where p.municipio_id = fotos.municipio_id and p.id = fotos.prestador_id and p.status = 'publicado')
        or exists (select 1 from public.atividades t where t.municipio_id = fotos.municipio_id and t.id = fotos.atividade_id and t.status = 'publicado')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Limite de 12 fotos por cadastro e posição da nova foto (sempre no fim)
-- ---------------------------------------------------------------------------

create function privado.preparar_foto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dono uuid := coalesce(new.atrativo_id, new.evento_id, new.prestador_id, new.atividade_id);
  v_total integer;
  v_maior integer;
begin
  -- Envios simultâneos para o mesmo cadastro entram um de cada vez.
  perform pg_advisory_xact_lock(hashtextextended('fotos:' || v_dono::text, 0));
  select count(*), max(f.ordem) into v_total, v_maior
    from public.fotos f
   where f.municipio_id = new.municipio_id
     and coalesce(f.atrativo_id, f.evento_id, f.prestador_id, f.atividade_id) = v_dono;
  if v_total >= 12 then
    raise exception 'limite_fotos' using errcode = 'P0001', detail = 'Cada cadastro aceita até 12 fotos.';
  end if;
  new.ordem := coalesce(v_maior + 1, 0);
  return new;
end;
$$;

revoke all on function privado.preparar_foto() from public;

create trigger fotos_preparar before insert on public.fotos
  for each row execute function privado.preparar_foto();

-- ---------------------------------------------------------------------------
-- Reordenação: coloca a foto na posição pedida (0 = capa) e renumera as demais
-- ---------------------------------------------------------------------------

-- security invoker: a RLS e o privilégio de UPDATE em `ordem` valem como em qualquer gravação.
create function public.posicionar_foto(p_foto uuid, p_posicao integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.fotos;
  v_ids uuid[];
  v_pos integer;
begin
  select * into v from public.fotos f where f.id = p_foto;
  if not found then
    raise exception 'foto_inexistente' using errcode = 'P0001';
  end if;
  if not (select privado.tem_papel(v.municipio_id, array['gestor'])) then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('fotos:' || coalesce(v.atrativo_id, v.evento_id, v.prestador_id, v.atividade_id)::text, 0));

  select array_agg(f.id order by f.ordem, f.criado_em, f.id) into v_ids
    from public.fotos f
   where f.municipio_id = v.municipio_id
     and f.atrativo_id is not distinct from v.atrativo_id
     and f.evento_id is not distinct from v.evento_id
     and f.prestador_id is not distinct from v.prestador_id
     and f.atividade_id is not distinct from v.atividade_id
     and f.id <> p_foto;

  v_ids := coalesce(v_ids, array[]::uuid[]);
  v_pos := greatest(0, least(coalesce(p_posicao, 0), cardinality(v_ids)));
  v_ids := v_ids[1:v_pos] || p_foto || v_ids[v_pos + 1:];

  update public.fotos f
     set ordem = x.i - 1
    from unnest(v_ids) with ordinality as x(id, i)
   where f.id = x.id
     and f.ordem <> x.i - 1;
end;
$$;

revoke all on function public.posicionar_foto(uuid, integer) from public, anon;
grant execute on function public.posicionar_foto(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado `originais` para a foto como veio do celular
-- ---------------------------------------------------------------------------
-- Guarda o arquivo só entre o envio e o tratamento no servidor (sem EXIF, até 2000 px), que
-- grava a versão publicada no bucket `publico` e apaga o original. Nunca é público: o original
-- pode ter a localização GPS de quem tirou a foto. Até 10 MB, porque fotos de celular passam
-- de 5 MB; a versão publicada fica bem abaixo do limite do `publico`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('originais', 'originais', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy originais_gestor_leitura on storage.objects for select to authenticated
  using (bucket_id = 'originais' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy originais_gestor_inclusao on storage.objects for insert to authenticated
  with check (bucket_id = 'originais' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy originais_gestor_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'originais' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
