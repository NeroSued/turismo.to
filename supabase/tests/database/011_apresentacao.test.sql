-- Fase 9 (item 9.1): frase de apresentação do município em configuracoes_municipio.
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.municipios (id, slug, nome, ativo) values
  ('19000000-0000-4000-8000-00000000000a', 'apresa', 'Apresentação A', true),
  ('19000000-0000-4000-8000-00000000000b', 'apresb', 'Apresentação B', true);

insert into auth.users (id, email, aud, role) values
  ('29000000-0000-4000-8000-000000000001', 'gestora@apres.test', 'authenticated', 'authenticated');
insert into public.vinculos (user_id, municipio_id, papel) values
  ('29000000-0000-4000-8000-000000000001', '19000000-0000-4000-8000-00000000000a', 'gestor');

select has_column('public', 'configuracoes_municipio', 'apresentacao', 'configuracoes_municipio tem a coluna apresentacao');

select throws_ok(
  $$update public.configuracoes_municipio set apresentacao = repeat('a', 161) where municipio_id = '19000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'frase com mais de 160 caracteres é recusada pelo banco');

select throws_ok(
  $$update public.configuracoes_municipio set apresentacao = '   ' where municipio_id = '19000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'frase só com espaços é recusada (vazio vira nulo no servidor)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

update public.configuracoes_municipio set apresentacao = repeat('b', 160) where municipio_id = '19000000-0000-4000-8000-00000000000a';
select is(
  (select length(apresentacao) from public.configuracoes_municipio where municipio_id = '19000000-0000-4000-8000-00000000000a'),
  160, 'gestor grava a frase de até 160 caracteres no próprio município');

update public.configuracoes_municipio set apresentacao = 'Invasão' where municipio_id = '19000000-0000-4000-8000-00000000000b';
reset role;
select is(
  (select apresentacao from public.configuracoes_municipio where municipio_id = '19000000-0000-4000-8000-00000000000b'),
  null, 'gestor não altera a frase de outro município');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select length(apresentacao) from public.configuracoes_municipio where municipio_id = '19000000-0000-4000-8000-00000000000a'),
  160, 'visitante anônimo lê a frase de município ativo');
reset role;

update public.municipios set ativo = false where id = '19000000-0000-4000-8000-00000000000a';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select count(*)::int from public.configuracoes_municipio where municipio_id = '19000000-0000-4000-8000-00000000000a'),
  0, 'visitante anônimo não lê a frase de município inativo');
reset role;

select * from finish();
rollback;
