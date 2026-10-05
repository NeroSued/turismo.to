-- Fase 2 (item 2.2): buckets publico e interno, com políticas por pasta "<municipio_id>/".
--
--   * publico: fotos publicadas, logo e capa. Leitura pela URL pública (bucket público).
--     JPEG, PNG ou WebP até 5 MB.
--   * interno: comprovantes de adesão (e, na Fase 3, listas de presença, atas e anexos).
--     Privado; leitura só por URL assinada de curta duração. PDF, JPEG ou PNG até 10 MB.
--   * Gravar, trocar, apagar e listar: só o gestor do município da pasta (e o admin).
--     Operador e anônimo não têm política nenhuma em storage.objects.
-- Tipo e tamanho também são validados no servidor antes do envio (src/lib/arquivos).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('publico', 'publico', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('interno', 'interno', false, 10 * 1024 * 1024, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Município dono do objeto: o primeiro segmento do caminho, se for um UUID. Senão, nulo.
create function privado.municipio_da_pasta(p_nome text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_nome, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_nome, '/', 1)::uuid
  end;
$$;

revoke all on function privado.municipio_da_pasta(text) from public;
grant execute on function privado.municipio_da_pasta(text) to anon, authenticated, service_role;

create policy publico_gestor_leitura on storage.objects for select to authenticated
  using (bucket_id = 'publico' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy publico_gestor_inclusao on storage.objects for insert to authenticated
  with check (bucket_id = 'publico' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy publico_gestor_alteracao on storage.objects for update to authenticated
  using (bucket_id = 'publico' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])))
  with check (bucket_id = 'publico' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy publico_gestor_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'publico' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));

create policy interno_gestor_leitura on storage.objects for select to authenticated
  using (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy interno_gestor_inclusao on storage.objects for insert to authenticated
  with check (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy interno_gestor_alteracao on storage.objects for update to authenticated
  using (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])))
  with check (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
create policy interno_gestor_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'interno' and (select privado.tem_papel(privado.municipio_da_pasta(name), array['gestor'])));
