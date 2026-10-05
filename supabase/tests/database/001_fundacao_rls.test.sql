-- Fase 0: RLS de municípios, configurações, perfis, vínculos e auditoria.
-- Roda com `npm run test:db` (supabase test db) no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- ---------------------------------------------------------------------------
-- Estrutura: RLS ativa e com políticas em todas as tabelas de public
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'todas as tabelas de public têm RLS ativa'
);

select is(
  (select count(*)::int from pg_tables t
   where t.schemaname = 'public'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)),
  0,
  'todas as tabelas de public têm ao menos uma política'
);

select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'privado') and p.prosecdef
     and not coalesce(p.proconfig @> array['search_path=""'], false)),
  0,
  'toda função security definer fixa search_path vazio'
);

select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef),
  0,
  'nenhuma função security definer fica no schema exposto public'
);

-- ---------------------------------------------------------------------------
-- Dados de teste
-- ---------------------------------------------------------------------------

insert into public.municipios (id, slug, nome, ativo) values
  ('10000000-0000-4000-8000-000000000001', 'testea', 'Teste A', true),
  ('10000000-0000-4000-8000-000000000002', 'testeb', 'Teste B', true),
  ('10000000-0000-4000-8000-000000000003', 'testeinativo', 'Teste Inativo', false);

insert into auth.users (id, email, aud, role) values
  ('20000000-0000-4000-8000-000000000001', 'admin@t.test', 'authenticated', 'authenticated'),
  ('20000000-0000-4000-8000-000000000002', 'gestora@t.test', 'authenticated', 'authenticated'),
  ('20000000-0000-4000-8000-000000000003', 'operadora@t.test', 'authenticated', 'authenticated'),
  ('20000000-0000-4000-8000-000000000004', 'semvinculo@t.test', 'authenticated', 'authenticated'),
  ('20000000-0000-4000-8000-000000000005', 'gestorb@t.test', 'authenticated', 'authenticated');

select is(
  (select count(*)::int from public.perfis where user_id::text like '20000000-%'),
  5,
  'trigger cria um perfil para cada usuário do Auth'
);

select is(
  (select count(*)::int from public.configuracoes_municipio where municipio_id::text like '10000000-%'),
  3,
  'trigger cria a configuração de cada município'
);

update public.perfis set admin_assessoria = true where user_id = '20000000-0000-4000-8000-000000000001';

insert into public.vinculos (id, user_id, municipio_id, papel) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'gestor'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'operador'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'gestor');

-- ---------------------------------------------------------------------------
-- Visitante anônimo: só dados públicos de municípios ativos
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::int from public.municipios where slug in ('testea', 'testeb', 'testeinativo')),
  2,
  'anônimo vê só os municípios ativos'
);
select is(
  (select count(*)::int from public.configuracoes_municipio where municipio_id = '10000000-0000-4000-8000-000000000003'),
  0,
  'anônimo não vê configuração de município inativo'
);
select ok(
  (select count(*) from public.configuracoes_municipio where municipio_id = '10000000-0000-4000-8000-000000000001') = 1,
  'anônimo vê configuração pública de município ativo'
);
select throws_ok('select * from public.perfis', '42501', null, 'anônimo não lê perfis');
select throws_ok('select * from public.vinculos', '42501', null, 'anônimo não lê vínculos');
select throws_ok('select * from public.auditoria', '42501', null, 'anônimo não lê auditoria');
select throws_ok(
  $$insert into public.municipios (slug, nome) values ('invasor', 'Invasor')$$,
  '42501', null, 'anônimo não cria município'
);
select throws_ok(
  $$update public.configuracoes_municipio set cor_primaria = '#000000'$$,
  '42501', null, 'anônimo não altera configuração'
);
select ok(not privado.eh_admin(), 'anônimo não é admin');

reset role;

-- ---------------------------------------------------------------------------
-- Usuário sem vínculo: não lê perfis nem vínculos de outros
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select is(
  (select array_agg(user_id::text) from public.perfis),
  array['20000000-0000-4000-8000-000000000004'],
  'usuário sem vínculo vê apenas o próprio perfil'
);
select is((select count(*)::int from public.vinculos), 0, 'usuário sem vínculo não vê vínculos de outros');
select is((select count(*)::int from public.auditoria), 0, 'usuário sem vínculo não vê auditoria');
select ok(not privado.tem_papel('10000000-0000-4000-8000-000000000001', array['gestor', 'operador']), 'usuário sem vínculo não tem papel no município');

-- Tenta se promover a admin
select throws_ok(
  $$update public.perfis set admin_assessoria = true where user_id = '20000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'usuário não se promove a admin'
);
-- Tenta criar vínculo para si
select throws_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel) values ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'gestor')$$,
  '42501', null, 'usuário não cria vínculo para si'
);
-- Tenta alterar perfil de outro (RLS filtra: zero linhas)
update public.perfis set nome = 'hack' where user_id = '20000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select nome from public.perfis where user_id = '20000000-0000-4000-8000-000000000002'),
  null,
  'usuário não altera perfil de outro'
);

-- ---------------------------------------------------------------------------
-- Gestora do município A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select ok(privado.tem_papel('10000000-0000-4000-8000-000000000001', array['gestor']), 'gestora tem papel no município A');
select ok(not privado.tem_papel('10000000-0000-4000-8000-000000000002', array['gestor', 'operador']), 'gestora não tem papel no município B');
select is(
  (select count(*)::int from public.vinculos),
  2,
  'gestora vê só os vínculos do município A'
);
select is(
  (select count(*)::int from public.perfis),
  1,
  'gestora vê só o próprio perfil'
);

-- Tenta mudar o próprio vínculo e o de outro usuário (RLS filtra: zero linhas, conferido abaixo)
update public.vinculos set ativo = false where id = '30000000-0000-4000-8000-000000000001';
-- Fase 4: vínculo não muda de usuário nem de município (só papel e situação são alteráveis).
select throws_ok(
  $$update public.vinculos set municipio_id = '10000000-0000-4000-8000-000000000002' where id = '30000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'gestora não move vínculo para outro município'
);
select throws_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel) values ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'gestor')$$,
  '42501', null, 'gestora não cria vínculo em outro município'
);
select throws_ok(
  $$update public.perfis set admin_assessoria = true where user_id = '20000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'gestora não se promove a admin'
);

-- Configuração: altera a do próprio município, não a do outro
update public.configuracoes_municipio set nome_exibicao = 'Portal A' where municipio_id = '10000000-0000-4000-8000-000000000001';
update public.configuracoes_municipio set nome_exibicao = 'Invadido' where municipio_id = '10000000-0000-4000-8000-000000000002';
-- Gestora não desativa o município (só admin altera municipios)
update public.municipios set ativo = false where id = '10000000-0000-4000-8000-000000000001';

reset role;

select ok(
  (select ativo and papel = 'gestor' from public.vinculos where id = '30000000-0000-4000-8000-000000000001'),
  'o próprio vínculo da gestora continua igual'
);
select ok(
  (select ativo from public.municipios where id = '10000000-0000-4000-8000-000000000001'),
  'gestora não desativa o município'
);
select is(
  (select municipio_id::text from public.vinculos where id = '30000000-0000-4000-8000-000000000002'),
  '10000000-0000-4000-8000-000000000001',
  'o vínculo continua no município A'
);
select is(
  (select nome_exibicao from public.configuracoes_municipio where municipio_id = '10000000-0000-4000-8000-000000000001'),
  'Portal A',
  'gestora altera a configuração do próprio município'
);
select is(
  (select nome_exibicao from public.configuracoes_municipio where municipio_id = '10000000-0000-4000-8000-000000000002'),
  null,
  'gestora não altera a configuração de outro município'
);

-- ---------------------------------------------------------------------------
-- Admin da assessoria
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(privado.eh_admin(), 'admin é reconhecido');
select ok(privado.tem_papel('10000000-0000-4000-8000-000000000002', array['gestor']), 'admin passa na checagem de qualquer município');
select ok(
  (select count(*) from public.municipios where slug = 'testeinativo') = 1,
  'admin vê município inativo'
);

-- Admin promove outro usuário, mas não remove o próprio admin
update public.perfis set admin_assessoria = true where user_id = '20000000-0000-4000-8000-000000000005';
select throws_ok(
  $$update public.perfis set admin_assessoria = false where user_id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'admin não altera o próprio perfil administrativo'
);
select throws_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel) values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'gestor')$$,
  '42501', null, 'admin não cria vínculo para si'
);
insert into public.vinculos (user_id, municipio_id, papel)
values ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'operador');

reset role;

select ok(
  (select admin_assessoria from public.perfis where user_id = '20000000-0000-4000-8000-000000000005'),
  'admin promove outro usuário'
);
select is(
  (select count(*)::int from public.vinculos where user_id = '20000000-0000-4000-8000-000000000004'),
  1,
  'admin cria vínculo para outro usuário'
);

-- ---------------------------------------------------------------------------
-- Auditoria preenchida por trigger, com autor
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'vinculos' and operacao = 'INSERT'
      and usuario_id = '20000000-0000-4000-8000-000000000001'
      and municipio_id = '10000000-0000-4000-8000-000000000002'
  ),
  'auditoria registra quem criou o vínculo e em qual município'
);
select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'configuracoes_municipio' and operacao = 'UPDATE'
      and usuario_id = '20000000-0000-4000-8000-000000000002'
      and depois ->> 'nome_exibicao' = 'Portal A'
  ),
  'auditoria registra a alteração de configuração com o autor'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.auditoria (tabela, operacao) values ('x', 'INSERT')$$,
  '42501', null, 'nem o admin grava diretamente na auditoria'
);
reset role;

select * from finish();
rollback;
