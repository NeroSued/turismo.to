-- Fase 5: anonimização de nome e contato (D10).
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------------------
-- Dados: município A (prazo padrão, 90 dias) e B (prazo de 30 dias)
-- ---------------------------------------------------------------------------

insert into public.municipios (id, slug, nome, ativo) values
  ('17000000-0000-4000-8000-00000000000a', 'priva', 'Privacidade A', true),
  ('17000000-0000-4000-8000-00000000000b', 'privb', 'Privacidade B', true);

update public.configuracoes_municipio set dias_anonimizacao = 30
where municipio_id = '17000000-0000-4000-8000-00000000000b';

insert into auth.users (id, email, aud, role) values
  ('27000000-0000-4000-8000-000000000001', 'gestora@p.test', 'authenticated', 'authenticated');
insert into public.vinculos (user_id, municipio_id, papel) values
  ('27000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-00000000000a', 'gestor');

insert into public.atividades (id, municipio_id, titulo, modo, status, exige_responsavel, exige_contato) values
  ('67000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-00000000000a', 'Mirante A', 'registro_voluntario', 'publicado', true, true),
  ('67000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-00000000000b', 'Mirante B', 'registro_voluntario', 'publicado', true, true);

create temporary table emitidos (rotulo text, voucher_id uuid, codigo text, token text, repetido boolean) on commit drop;

insert into emitidos select 'a91', * from privado.emitir_voucher_publico('17000000-0000-4000-8000-00000000000a',
  '67000000-0000-4000-8000-000000000001', null, privado.hoje_local(), 3, 'Gurupi', 'TO', 'Maria da Silva', '63 99999-0001', gen_random_uuid());
insert into emitidos select 'a90', * from privado.emitir_voucher_publico('17000000-0000-4000-8000-00000000000a',
  '67000000-0000-4000-8000-000000000001', null, privado.hoje_local(), 2, 'Goiânia', 'GO', 'João Pereira', 'joao@exemplo.test', gen_random_uuid());
insert into emitidos select 'a89', * from privado.emitir_voucher_publico('17000000-0000-4000-8000-00000000000a',
  '67000000-0000-4000-8000-000000000001', null, privado.hoje_local(), 4, 'Gurupi', 'TO', 'Ana Souza', '63 99999-0003', gen_random_uuid());
insert into emitidos select 'b31', * from privado.emitir_voucher_publico('17000000-0000-4000-8000-00000000000b',
  '67000000-0000-4000-8000-000000000002', null, privado.hoje_local(), 1, 'Palmas', 'TO', 'Carlos Lima', '63 99999-0004', gen_random_uuid());

-- Coloca os vouchers no passado (a emissão só aceita datas futuras): um utilizado, um expirado.
update public.vouchers v set data_visita = privado.hoje_local() - 91,
  status = 'utilizado', utilizado_em = now() - interval '91 days', pessoas_atendidas = 2
from emitidos e where e.voucher_id = v.id and e.rotulo = 'a91';
update public.vouchers v set data_visita = privado.hoje_local() - 90, status = 'expirado', expirado_em = now() - interval '89 days'
from emitidos e where e.voucher_id = v.id and e.rotulo = 'a90';
update public.vouchers v set data_visita = privado.hoje_local() - 89, status = 'expirado', expirado_em = now() - interval '88 days'
from emitidos e where e.voucher_id = v.id and e.rotulo = 'a89';
update public.vouchers v set data_visita = privado.hoje_local() - 31, status = 'expirado', expirado_em = now() - interval '30 days'
from emitidos e where e.voucher_id = v.id and e.rotulo = 'b31';

-- Fotografia do que precisa sobreviver: cidade, UF, pessoas, atendidas e estado de cada voucher,
-- e o relatório do gestor de A no período.
create temporary table antes on commit drop as
select v.id, v.cidade, v.uf, v.pessoas, v.pessoas_atendidas, v.status, v.data_visita
from public.vouchers v join emitidos e on e.voucher_id = v.id;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
create temporary table relatorio_antes on commit drop as
select public.relatorio_completo('17000000-0000-4000-8000-00000000000a', privado.hoje_local() - 120, privado.hoje_local()) as r;
reset role;

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname = 'anonimizar_vouchers'),
  'anonimizar_vouchers é security definer com search_path vazio'
);
select ok(
  not has_function_privilege('anon', 'privado.anonimizar_vouchers()', 'execute')
  and not has_function_privilege('authenticated', 'privado.anonimizar_vouchers()', 'execute'),
  'anônimo e usuário logado não executam a anonimização'
);
select is(
  (select schedule from cron.job where jobname = 'anonimizar-vouchers'),
  '15 3 * * *', 'anonimização agendada todo dia no pg_cron'
);

-- ---------------------------------------------------------------------------
-- Execução
-- ---------------------------------------------------------------------------

select is(privado.anonimizar_vouchers(), 3, 'anonimiza 3 vouchers: A com 91 e 90 dias, B com 31 dias (prazo 30)');

select is(
  (select count(*)::int from public.vouchers v join emitidos e on e.voucher_id = v.id
   where e.rotulo in ('a91', 'a90', 'b31') and v.nome_responsavel is null and v.contato is null and v.anonimizado_em is not null),
  3, 'nome e contato apagados e horário da anonimização gravado nos vouchers vencidos'
);
select is(
  (select v.nome_responsavel || ' | ' || v.contato from public.vouchers v join emitidos e on e.voucher_id = v.id where e.rotulo = 'a89'),
  'Ana Souza | 63 99999-0003', 'voucher dentro do prazo (89 dias) mantém nome e contato'
);
select is(
  (select v.anonimizado_em from public.vouchers v join emitidos e on e.voucher_id = v.id where e.rotulo = 'a89'),
  null, 'voucher dentro do prazo não é marcado como anonimizado'
);
select is(
  (select count(*)::int from public.vouchers v join antes a on a.id = v.id
   where (v.cidade, v.uf, v.pessoas, v.pessoas_atendidas, v.status, v.data_visita)
     is not distinct from (a.cidade, a.uf, a.pessoas, a.pessoas_atendidas, a.status, a.data_visita)),
  4, 'cidade, UF, pessoas, pessoas atendidas, estado e dia preservados nos 4 vouchers'
);
select is(
  (select v.cidade || '/' || v.uf || ' · ' || v.pessoas || ' pessoas · ' || v.pessoas_atendidas || ' atendidas'
   from public.vouchers v join emitidos e on e.voucher_id = v.id where e.rotulo = 'a91'),
  'Gurupi/TO · 3 pessoas · 2 atendidas', 'voucher utilizado anonimizado continua com origem e contagens'
);
select is(
  (select count(*)::int from public.auditoria a join emitidos e on a.registro_id = e.voucher_id::text
   where a.tabela = 'vouchers' and (a.antes::text ~ 'Maria da Silva|João Pereira|Carlos Lima|99999'
                                    or a.depois::text ~ 'Maria da Silva|João Pereira|Carlos Lima|99999')),
  0, 'auditoria não guarda nome nem contato (nem antes, nem depois da anonimização)'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  public.relatorio_completo('17000000-0000-4000-8000-00000000000a', privado.hoje_local() - 120, privado.hoje_local()),
  (select r from relatorio_antes),
  'relatório do gestor (contagens, pessoas, participações e origem por cidade e UF) idêntico antes e depois'
);
select is(
  (select count(*)::int from public.vouchers where nome_responsavel is not null),
  1, 'gestor passa a ver nome só no voucher dentro do prazo'
);
reset role;

-- Rodar de novo não muda nada.
select is(privado.anonimizar_vouchers(), 0, 'segunda execução não encontra mais nada para anonimizar');

-- Mudar o prazo do município vale na próxima execução.
update public.configuracoes_municipio set dias_anonimizacao = 60 where municipio_id = '17000000-0000-4000-8000-00000000000a';
select is(privado.anonimizar_vouchers(), 1, 'com prazo de 60 dias o voucher de 89 dias também é anonimizado');

select * from finish();
rollback;
