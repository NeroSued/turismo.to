-- Fase 7: capa e galeria (ordem, capa, limite de 12), fotos de atividades, legenda opcional,
-- crédito, descrição de prestadores e eventos e bucket `originais`.
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

insert into public.municipios (id, slug, nome, ativo) values
  ('17000000-0000-4000-8000-00000000000a', 'galeriaa', 'Galeria A', true),
  ('17000000-0000-4000-8000-00000000000b', 'galeriab', 'Galeria B', true);

insert into auth.users (id, email, aud, role) values
  ('27000000-0000-4000-8000-000000000002', 'gestora@g.test', 'authenticated', 'authenticated'),
  ('27000000-0000-4000-8000-000000000003', 'operadora@g.test', 'authenticated', 'authenticated'),
  ('27000000-0000-4000-8000-000000000004', 'gestorb@g.test', 'authenticated', 'authenticated');

insert into public.vinculos (user_id, municipio_id, papel) values
  ('27000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-00000000000a', 'gestor'),
  ('27000000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-00000000000a', 'operador'),
  ('27000000-0000-4000-8000-000000000004', '17000000-0000-4000-8000-00000000000b', 'gestor');

insert into public.atrativos (id, municipio_id, nome, categoria, status) values
  ('37000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-00000000000a', 'Cachoeira', 'natureza', 'publicado'),
  ('37000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-00000000000a', 'Gruta', 'natureza', 'publicado');

insert into public.atividades (id, municipio_id, titulo, modo, status) values
  ('77000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-00000000000a', 'Trilha publicada', 'reserva', 'publicado'),
  ('77000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-00000000000a', 'Trilha em rascunho', 'reserva', 'rascunho'),
  ('77000000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-00000000000b', 'Trilha de B', 'reserva', 'publicado');

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'originais'),
  row(false, 10485760::bigint, array['image/jpeg', 'image/png', 'image/webp'])::text,
  'bucket originais: privado, até 10 MB, JPEG/PNG/WebP'
);
select is(
  (select prosecdef::text || coalesce(array_to_string(proconfig, ','), '') from pg_proc where oid = 'public.posicionar_foto(uuid, integer)'::regprocedure),
  'falsesearch_path=""',
  'posicionar_foto é security invoker com search_path vazio'
);
select ok(not has_function_privilege('anon', 'public.posicionar_foto(uuid, integer)', 'execute'), 'anônimo não executa posicionar_foto');
select is(
  (select prosecdef::text || coalesce(array_to_string(proconfig, ','), '') from pg_proc where oid = 'privado.preparar_foto()'::regprocedure),
  'truesearch_path=""',
  'preparar_foto é security definer com search_path vazio'
);

-- ---------------------------------------------------------------------------
-- Gestora de A: ordem, capa e limite
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- Doze fotos no atrativo: cada uma entra no fim, mesmo pedindo outra ordem.
insert into public.fotos (municipio_id, caminho, legenda, atrativo_id, ordem)
select '17000000-0000-4000-8000-00000000000a',
       '17000000-0000-4000-8000-00000000000a/fotos/f' || lpad(n::text, 2, '0') || '.webp',
       case when n = 3 then null else 'Foto número ' || n end,
       '37000000-0000-4000-8000-000000000001',
       0
  from generate_series(1, 12) as n
 order by n;

select results_eq(
  $$select ordem from public.fotos where atrativo_id = '37000000-0000-4000-8000-000000000001' order by caminho$$,
  $$select generate_series(0, 11)$$,
  'novas fotos entram no fim, na ordem de envio (0 a 11), mesmo pedindo ordem 0'
);
select is(
  (select caminho from public.fotos where atrativo_id = '37000000-0000-4000-8000-000000000001' order by ordem limit 1),
  '17000000-0000-4000-8000-00000000000a/fotos/f01.webp',
  'a capa é a primeira enviada'
);
select is(
  (select legenda from public.fotos where caminho like '%/f03.webp'),
  null,
  'legenda é opcional'
);

select throws_ok(
  $$insert into public.fotos (municipio_id, caminho, atrativo_id) values
    ('17000000-0000-4000-8000-00000000000a', '17000000-0000-4000-8000-00000000000a/fotos/f13.webp', '37000000-0000-4000-8000-000000000001')$$,
  'P0001', 'limite_fotos', 'a 13ª foto do mesmo cadastro é recusada'
);
select is(
  (select count(*)::int from public.fotos where atrativo_id = '37000000-0000-4000-8000-000000000001'),
  12, 'o atrativo continua com 12 fotos'
);
select lives_ok(
  $$insert into public.fotos (municipio_id, caminho, atrativo_id) values
    ('17000000-0000-4000-8000-00000000000a', '17000000-0000-4000-8000-00000000000a/fotos/outro.webp', '37000000-0000-4000-8000-000000000002')$$,
  'o limite é por cadastro: outro atrativo aceita fotos'
);

-- Tornar capa: a foto 7 vai para a posição 0; as demais descem uma posição, sem buracos.
select lives_ok(
  $$select public.posicionar_foto((select id from public.fotos where caminho like '%/f07.webp'), 0)$$,
  'gestora torna a foto 7 capa'
);
select results_eq(
  $$select right(caminho, 8) from public.fotos where atrativo_id = '37000000-0000-4000-8000-000000000001' order by ordem$$,
  $$values ('f07.webp'), ('f01.webp'), ('f02.webp'), ('f03.webp'), ('f04.webp'), ('f05.webp'), ('f06.webp'), ('f08.webp'), ('f09.webp'), ('f10.webp'), ('f11.webp'), ('f12.webp')$$,
  'nova capa primeiro; a ordem das outras se mantém'
);
select results_eq(
  $$select ordem from public.fotos where atrativo_id = '37000000-0000-4000-8000-000000000001' order by ordem$$,
  $$select generate_series(0, 11)$$,
  'ordem renumerada de 0 a 11'
);

-- Descer a foto 1 (posição 1) uma posição; subir a última uma posição.
select lives_ok(
  $$select public.posicionar_foto((select id from public.fotos where caminho like '%/f01.webp'), 2)$$,
  'gestora desce a foto 1'
);
select lives_ok(
  $$select public.posicionar_foto((select id from public.fotos where caminho like '%/f12.webp'), 10)$$,
  'gestora sobe a foto 12'
);
select results_eq(
  $$select right(caminho, 8) from public.fotos where atrativo_id = '37000000-0000-4000-8000-000000000001' order by ordem$$,
  $$values ('f07.webp'), ('f02.webp'), ('f01.webp'), ('f03.webp'), ('f04.webp'), ('f05.webp'), ('f06.webp'), ('f08.webp'), ('f09.webp'), ('f10.webp'), ('f12.webp'), ('f11.webp')$$,
  'descer e subir trocam só as vizinhas'
);
select lives_ok(
  $$select public.posicionar_foto((select id from public.fotos where caminho like '%/f11.webp'), 99)$$,
  'posição além do fim vai para o fim'
);
select is(
  (select right(caminho, 8) from public.fotos where atrativo_id = '37000000-0000-4000-8000-000000000001' order by ordem desc limit 1),
  'f11.webp', 'a foto 11 continua no fim'
);
select is(
  (select ordem from public.fotos where caminho like '%/outro.webp'),
  0, 'reordenar um atrativo não mexe nas fotos de outro'
);

-- Crédito e atividade
select lives_ok(
  $$update public.fotos set credito = 'Secretaria de Turismo' where atrativo_id = '37000000-0000-4000-8000-000000000001'$$,
  'gestora grava o crédito'
);
select throws_ok(
  $$update public.fotos set credito = repeat('x', 121) where caminho like '%/f01.webp'$$,
  '23514', null, 'crédito com mais de 120 caracteres é recusado'
);
select lives_ok(
  $$insert into public.fotos (municipio_id, caminho, legenda, atividade_id) values
    ('17000000-0000-4000-8000-00000000000a', '17000000-0000-4000-8000-00000000000a/fotos/trilha.webp', 'Trilha', '77000000-0000-4000-8000-000000000001'),
    ('17000000-0000-4000-8000-00000000000a', '17000000-0000-4000-8000-00000000000a/fotos/trilha2.webp', 'Trilha 2', '77000000-0000-4000-8000-000000000002')$$,
  'atividade aceita fotos'
);
select throws_ok(
  $$insert into public.fotos (municipio_id, caminho, atividade_id) values
    ('17000000-0000-4000-8000-00000000000a', '17000000-0000-4000-8000-00000000000a/fotos/mistura.webp', '77000000-0000-4000-8000-000000000003')$$,
  '23503', null, 'foto de A não aponta para atividade de B'
);

-- Descrição (7.6)
select lives_ok(
  $$insert into public.prestadores (municipio_id, nome_publico, categoria, situacao_rede, descricao) values
    ('17000000-0000-4000-8000-00000000000a', 'Pousada', 'hospedagem', 'participante', repeat('a', 2000))$$,
  'prestador aceita descrição de 2000 caracteres'
);
select throws_ok(
  $$insert into public.prestadores (municipio_id, nome_publico, categoria, situacao_rede, descricao) values
    ('17000000-0000-4000-8000-00000000000a', 'Pousada 2', 'hospedagem', 'participante', repeat('a', 2001))$$,
  '23514', null, 'descrição de prestador acima de 2000 caracteres é recusada'
);
select throws_ok(
  $$insert into public.eventos (municipio_id, titulo, inicio, fim, descricao) values
    ('17000000-0000-4000-8000-00000000000a', 'Festa', now(), now() + interval '1 hour', repeat('a', 2001))$$,
  '23514', null, 'descrição de evento acima de 2000 caracteres é recusada'
);

-- ---------------------------------------------------------------------------
-- Outros papéis e o visitante
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$select public.posicionar_foto((select '00000000-0000-4000-8000-000000000000'::uuid), 0)$$,
  'P0001', 'foto_inexistente', 'gestor de B não enxerga a foto de A (como se não existisse)'
);

select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(
  format($$select public.posicionar_foto(%L, 0)$$,
    (select id from public.fotos where caminho = '17000000-0000-4000-8000-00000000000a/fotos/f02.webp')),
  'P0001', 'sem_permissao', 'operadora vê a foto, mas não reordena'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select results_eq(
  $$select caminho from public.fotos where atividade_id is not null order by caminho$$,
  $$values ('17000000-0000-4000-8000-00000000000a/fotos/trilha.webp')$$,
  'visitante vê a foto da atividade publicada e não a da atividade em rascunho'
);

select * from finish();
rollback;
