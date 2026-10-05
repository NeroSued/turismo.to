-- Fase 2: atrativos, eventos, prestadores, adesões, fotos, configurações e Storage.
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- Dados: município A (como Palmeirópolis), B (como Peixe) e C inativo
-- ---------------------------------------------------------------------------

insert into public.municipios (id, slug, nome, ativo) values
  ('12000000-0000-4000-8000-00000000000a', 'portala', 'Portal A', true),
  ('12000000-0000-4000-8000-00000000000b', 'portalb', 'Portal B', true),
  ('12000000-0000-4000-8000-00000000000c', 'portalc', 'Portal C', false);

insert into auth.users (id, email, aud, role) values
  ('22000000-0000-4000-8000-000000000001', 'admin@p.test', 'authenticated', 'authenticated'),
  ('22000000-0000-4000-8000-000000000002', 'gestora@p.test', 'authenticated', 'authenticated'),
  ('22000000-0000-4000-8000-000000000003', 'operadora@p.test', 'authenticated', 'authenticated'),
  ('22000000-0000-4000-8000-000000000004', 'gestorb@p.test', 'authenticated', 'authenticated');

update public.perfis set admin_assessoria = true where user_id = '22000000-0000-4000-8000-000000000001';

insert into public.vinculos (user_id, municipio_id, papel) values
  ('22000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-00000000000a', 'gestor'),
  ('22000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-00000000000a', 'operador'),
  ('22000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-00000000000b', 'gestor');

insert into public.atrativos (id, municipio_id, nome, categoria, status) values
  ('32000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-00000000000a', 'Cachoeira publicada', 'natureza', 'publicado'),
  ('32000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-00000000000a', 'Gruta em rascunho', 'natureza', 'rascunho'),
  ('32000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-00000000000a', 'Museu arquivado', 'cultura', 'arquivado'),
  ('32000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-00000000000c', 'Atrativo de inativo', 'natureza', 'publicado');

insert into public.eventos (id, municipio_id, titulo, inicio, fim, status, atrativo_id) values
  ('42000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-00000000000a', 'Festa publicada',
   now() + interval '5 days', now() + interval '6 days', 'publicado', '32000000-0000-4000-8000-000000000001'),
  ('42000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-00000000000a', 'Festa em rascunho',
   now() + interval '5 days', now() + interval '6 days', 'rascunho', null),
  ('42000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-00000000000a', 'Festa arquivada',
   now() + interval '5 days', now() + interval '6 days', 'arquivado', null);

insert into public.prestadores (id, municipio_id, nome_publico, categoria, situacao_rede, status, contatos_publicos) values
  ('52000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-00000000000a', 'Pousada publicada', 'hospedagem', 'participante', 'publicado', '(63) 3000-0000'),
  ('52000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-00000000000a', 'Guia em rascunho', 'guias', 'em_adesao', 'rascunho', null),
  ('52000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-00000000000a', 'Bar arquivado', 'alimentacao', 'desligado', 'arquivado', null);

insert into public.adesoes_prestador (municipio_id, prestador_id, data_adesao, responsavel, contato_interno, comprovante_caminho) values
  ('12000000-0000-4000-8000-00000000000a', '52000000-0000-4000-8000-000000000001', current_date, 'Responsável Interno',
   '63 99999-0000 (interno)', '12000000-0000-4000-8000-00000000000a/adesoes/termo.pdf');

insert into public.fotos (municipio_id, caminho, legenda, atrativo_id, evento_id, prestador_id) values
  ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000a/fotos/pub.jpg', 'Queda d''água', '32000000-0000-4000-8000-000000000001', null, null),
  ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000a/fotos/rasc.jpg', 'Entrada da gruta', '32000000-0000-4000-8000-000000000002', null, null),
  ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000a/fotos/evento.jpg', 'Palco', null, '42000000-0000-4000-8000-000000000002', null),
  ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000a/fotos/pousada.jpg', 'Fachada', null, null, '52000000-0000-4000-8000-000000000001');

-- Objetos do Storage já existentes em A (como se enviados pelo gestor de A)
insert into storage.objects (bucket_id, name) values
  ('publico', '12000000-0000-4000-8000-00000000000a/fotos/pub.jpg'),
  ('interno', '12000000-0000-4000-8000-00000000000a/adesoes/termo.pdf');

-- ---------------------------------------------------------------------------
-- Estrutura e configuração dos buckets
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_tables where schemaname = 'public'
     and tablename in ('atrativos', 'eventos', 'prestadores', 'adesoes_prestador', 'fotos') and rowsecurity),
  5, 'RLS ativa em atrativos, eventos, prestadores, adesoes_prestador e fotos'
);
select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'publico'),
  row(true, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp'])::text,
  'bucket publico: público, até 5 MB, JPEG/PNG/WebP'
);
select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'interno'),
  row(false, 10485760::bigint, array['application/pdf', 'image/jpeg', 'image/png'])::text,
  'bucket interno: privado, até 10 MB, PDF/JPEG/PNG'
);

-- ---------------------------------------------------------------------------
-- Visitante anônimo: só publicado, nada interno
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq(
  $$select nome from public.atrativos where municipio_id in ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000c') order by nome$$,
  $$values ('Cachoeira publicada'::text)$$,
  'anônimo vê só o atrativo publicado de município ativo (rascunho, arquivado e inativo ficam de fora)'
);
select results_eq(
  $$select titulo from public.eventos where municipio_id = '12000000-0000-4000-8000-00000000000a'$$,
  $$values ('Festa publicada'::text)$$,
  'anônimo vê só o evento publicado'
);
select results_eq(
  $$select nome_publico from public.prestadores where municipio_id = '12000000-0000-4000-8000-00000000000a'$$,
  $$values ('Pousada publicada'::text)$$,
  'anônimo vê só o prestador publicado'
);
select results_eq(
  $$select legenda from public.fotos where municipio_id = '12000000-0000-4000-8000-00000000000a' order by legenda$$,
  $$values ('Fachada'::text), ('Queda d''água'::text)$$,
  'anônimo vê só as fotos de conteúdo publicado'
);
select throws_ok('select * from public.adesoes_prestador', '42501', null,
  'anônimo não lê adesões (contato interno e comprovante)');
select throws_ok(
  $$insert into public.atrativos (municipio_id, nome, categoria) values ('12000000-0000-4000-8000-00000000000a', 'Invasor', 'outro')$$,
  '42501', null, 'anônimo não cadastra atrativo'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'interno'),
  0, 'anônimo não lê o bucket interno'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'publico'),
  0, 'anônimo não lista o bucket publico (fotos saem só pela URL pública)'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('publico', '12000000-0000-4000-8000-00000000000a/fotos/anon.jpg')$$,
  '42501', null, 'anônimo não grava no Storage'
);

reset role;

-- ---------------------------------------------------------------------------
-- Gestor de A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.atrativos where municipio_id = '12000000-0000-4000-8000-00000000000a'), 3,
  'gestor de A vê os atrativos em todos os estados');
select is((select count(*)::int from public.adesoes_prestador), 1, 'gestor de A lê as adesões de A');
select lives_ok(
  $$insert into public.atrativos (municipio_id, nome, categoria) values
    ('12000000-0000-4000-8000-00000000000a', 'Novo mirante', 'natureza')$$,
  'gestor de A cadastra atrativo em A'
);
select is(
  (select status from public.atrativos where nome = 'Novo mirante'),
  'rascunho', 'atrativo novo começa em elaboração'
);
select throws_ok(
  $$insert into public.atrativos (municipio_id, nome, categoria) values ('12000000-0000-4000-8000-00000000000b', 'Intruso', 'outro')$$,
  '42501', null, 'gestor de A não cadastra atrativo em B'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('publico', '12000000-0000-4000-8000-00000000000a/fotos/nova.jpg')$$,
  'gestor de A grava foto na pasta de A'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('interno', '12000000-0000-4000-8000-00000000000a/adesoes/novo.pdf')$$,
  'gestor de A grava comprovante na pasta interna de A'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'interno'),
  2, 'gestor de A lê a pasta interna de A'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('publico', '12000000-0000-4000-8000-00000000000b/fotos/x.jpg')$$,
  '42501', null, 'gestor de A não grava na pasta de B'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('publico', 'sem-municipio/x.jpg')$$,
  '42501', null, 'caminho fora de uma pasta de município é recusado'
);
select lives_ok(
  $$update public.atrativos set status = 'arquivado' where id = '32000000-0000-4000-8000-000000000001'$$,
  'gestor de A arquiva o atrativo publicado'
);
select is(
  (select usuario_id from public.auditoria where tabela = 'atrativos' and registro_id = '32000000-0000-4000-8000-000000000001'
     and operacao = 'UPDATE' order by id desc limit 1),
  '22000000-0000-4000-8000-000000000002'::uuid,
  'auditoria registra o gestor que arquivou'
);
select throws_ok(
  $$update public.configuracoes_municipio set cor_primaria = '#F2C94C' where municipio_id = '12000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'cor primária com contraste menor que 4.5:1 é recusada no banco'
);
select lives_ok(
  $$update public.configuracoes_municipio set cor_primaria = '#2B4A6B', ouvidoria_url = 'https://ouvidoria.exemplo.gov.br',
      logo_caminho = '12000000-0000-4000-8000-00000000000a/marca/logo.png' where municipio_id = '12000000-0000-4000-8000-00000000000a'$$,
  'gestor de A altera as configurações de A'
);
select throws_ok(
  $$update public.configuracoes_municipio set logo_caminho = '12000000-0000-4000-8000-00000000000b/marca/logo.png'
      where municipio_id = '12000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'logo precisa estar na pasta do próprio município'
);
-- A RLS filtra a linha de B: o update não falha, mas não altera nada (conferido abaixo, como dono).
update public.configuracoes_municipio set cor_primaria = '#2B4A6B' where municipio_id = '12000000-0000-4000-8000-00000000000b';

reset role;

-- Depois do arquivamento, o anônimo não vê mais o atrativo nem a foto dele
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select count(*)::int from public.atrativos where id = '32000000-0000-4000-8000-000000000001'),
  0, 'atrativo arquivado sai das consultas anônimas'
);
select is(
  (select count(*)::int from public.fotos where atrativo_id = '32000000-0000-4000-8000-000000000001'),
  0, 'foto de atrativo arquivado sai das consultas anônimas'
);
reset role;

-- ---------------------------------------------------------------------------
-- Operador de A: não lê adesões nem mexe no Storage
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is((select count(*)::int from public.adesoes_prestador), 0, 'operador não lê adesões');
select is((select count(*)::int from storage.objects where bucket_id = 'interno'), 0, 'operador não lê o bucket interno');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('publico', '12000000-0000-4000-8000-00000000000a/fotos/op.jpg')$$,
  '42501', null, 'operador não envia fotos'
);
select throws_ok(
  $$insert into public.prestadores (municipio_id, nome_publico, categoria) values ('12000000-0000-4000-8000-00000000000a', 'Op', 'outro')$$,
  '42501', null, 'operador não cadastra prestador'
);

reset role;

-- ---------------------------------------------------------------------------
-- Gestor de B (como Peixe) contra A (como Palmeirópolis)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.atrativos where municipio_id = '12000000-0000-4000-8000-00000000000a' and status <> 'publicado'),
  0, 'gestor de B não vê rascunhos nem arquivados de A'
);
select is((select count(*)::int from public.adesoes_prestador), 0, 'gestor de B não lê adesões de A');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('publico', '12000000-0000-4000-8000-00000000000a/fotos/b.jpg')$$,
  '42501', null, 'gestor de B não grava na pasta pública de A'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('interno', '12000000-0000-4000-8000-00000000000a/adesoes/b.pdf')$$,
  '42501', null, 'gestor de B não grava na pasta interna de A'
);
select is(
  (select count(*)::int from storage.objects where name like '12000000-0000-4000-8000-00000000000a/%'),
  0, 'gestor de B não lê objetos de A em nenhum bucket'
);
update public.atrativos set nome = 'Tomado' where municipio_id = '12000000-0000-4000-8000-00000000000a';
select throws_ok(
  $$insert into public.eventos (municipio_id, titulo, inicio, fim, atrativo_id) values
    ('12000000-0000-4000-8000-00000000000b', 'Evento misturado', now(), now() + interval '1 hour', '32000000-0000-4000-8000-000000000002')$$,
  '23503', null, 'evento de B não aponta para atrativo de A (FK composta)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Integridade (como dono)
-- ---------------------------------------------------------------------------

select is(
  (select cor_primaria from public.configuracoes_municipio where municipio_id = '12000000-0000-4000-8000-00000000000b'),
  '#1F4D3A', 'o update do gestor de A não alterou as configurações de B'
);
select is(
  (select count(*)::int from public.atrativos where nome = 'Tomado'),
  0, 'o update do gestor de B não alterou atrativos de A'
);

select throws_ok(
  $$insert into public.fotos (municipio_id, caminho, legenda, atrativo_id) values
    ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000b/fotos/x.jpg', 'Outra pasta', '32000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'foto com caminho na pasta de outro município é recusada'
);
select throws_ok(
  $$insert into public.fotos (municipio_id, caminho, legenda, atrativo_id) values
    ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000a/../x.jpg', 'Escapando', '32000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'caminho com ".." é recusado'
);
select throws_ok(
  $$insert into public.fotos (municipio_id, caminho, legenda, atrativo_id, evento_id) values
    ('12000000-0000-4000-8000-00000000000a', '12000000-0000-4000-8000-00000000000a/fotos/dupla.jpg', 'Dois donos',
     '32000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'foto pertence a um único conteúdo'
);
select throws_ok(
  $$insert into public.fotos (municipio_id, caminho, legenda, prestador_id) values
    ('12000000-0000-4000-8000-00000000000b', '12000000-0000-4000-8000-00000000000b/fotos/y.jpg', 'Mistura', '52000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'foto de B não aponta para prestador de A'
);
select throws_ok(
  $$insert into public.atividades (municipio_id, titulo, modo, atrativo_id) values
    ('12000000-0000-4000-8000-00000000000b', 'Atividade misturada', 'reserva', '32000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'atividade de B não aponta para atrativo de A'
);
select throws_ok(
  $$insert into public.adesoes_prestador (municipio_id, prestador_id, data_adesao, responsavel) values
    ('12000000-0000-4000-8000-00000000000b', '52000000-0000-4000-8000-000000000001', current_date, 'Mistura')$$,
  '23503', null, 'adesão de B não aponta para prestador de A'
);

select * from finish();
rollback;
