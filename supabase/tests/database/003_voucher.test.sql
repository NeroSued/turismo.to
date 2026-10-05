-- Fase 1: atividades, sessões, vouchers, limites, funções do voucher e auditoria.
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(75);

-- ---------------------------------------------------------------------------
-- Dados de teste: municípios A e B, admin, gestor e operador de A, gestor de B
-- ---------------------------------------------------------------------------

insert into public.municipios (id, slug, nome) values
  ('11000000-0000-4000-8000-000000000001', 'vouchera', 'Voucher A'),
  ('11000000-0000-4000-8000-000000000002', 'voucherb', 'Voucher B');

insert into auth.users (id, email, aud, role) values
  ('21000000-0000-4000-8000-000000000001', 'admin@v.test', 'authenticated', 'authenticated'),
  ('21000000-0000-4000-8000-000000000002', 'gestora@v.test', 'authenticated', 'authenticated'),
  ('21000000-0000-4000-8000-000000000003', 'operadora@v.test', 'authenticated', 'authenticated'),
  ('21000000-0000-4000-8000-000000000004', 'gestorb@v.test', 'authenticated', 'authenticated');

update public.perfis set admin_assessoria = true where user_id = '21000000-0000-4000-8000-000000000001';
update public.perfis set nome = 'Operadora A' where user_id = '21000000-0000-4000-8000-000000000003';

insert into public.vinculos (user_id, municipio_id, papel) values
  ('21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 'gestor'),
  ('21000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', 'operador'),
  ('21000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000002', 'gestor');

-- Atividades de A: reserva publicada, reserva em rascunho, registro voluntário publicado (exige nome)
insert into public.atividades (id, municipio_id, titulo, modo, status, max_pessoas_por_voucher, exige_responsavel) values
  ('41000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Trilha guiada', 'reserva', 'publicado', 10, false),
  ('41000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 'Rascunho', 'reserva', 'rascunho', 10, false),
  ('41000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', 'Cachoeira livre', 'registro_voluntario', 'publicado', 10, true);

-- Sessões: futura com 15 vagas; hoje (em andamento, para conferência); passada; da atividade em rascunho
insert into public.sessoes (id, municipio_id, atividade_id, inicio, fim, capacidade_pessoas) values
  ('51000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   now() + interval '2 days', now() + interval '2 days 2 hours', 15),
  ('51000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   now() - interval '30 minutes', now() + interval '1 hour', 20),
  ('51000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   now() - interval '3 days', now() - interval '3 days' + interval '2 hours', null),
  ('51000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002',
   now() + interval '2 days', now() + interval '2 days 2 hours', null);

-- Vouchers criados direto (como dono) para os testes de conferência: válido hoje, outro para cancelar,
-- um de sessão passada (vai expirar) e um de amanhã.
insert into public.vouchers (id, municipio_id, atividade_id, sessao_id, codigo, token_hash, chave_idempotencia, origem,
                             data_visita, pessoas, cidade, uf, nome_responsavel, contato) values
  ('61000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000002', 'HHHHHHHHHHH2', sha256('t1'), gen_random_uuid(), 'publico',
   privado.hoje_local(), 4, 'Gurupi', 'TO', 'Nome Sigiloso', '63999990000'),
  ('61000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000002', 'HHHHHHHHHHH3', sha256('t2'), gen_random_uuid(), 'publico',
   privado.hoje_local(), 2, 'Palmas', 'TO', null, null),
  ('61000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000003', 'HHHHHHHHHHH4', sha256('t3'), gen_random_uuid(), 'publico',
   privado.hoje_local() - 3, 3, 'Goiânia', 'GO', null, null),
  ('61000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000003',
   null, 'HHHHHHHHHHH5', sha256('t4'), gen_random_uuid(), 'publico',
   privado.hoje_local() + 1, 1, 'Brasília', 'DF', 'Fulano', null);
update public.sessoes set pessoas_reservadas = 6 where id = '51000000-0000-4000-8000-000000000002';
update public.sessoes set pessoas_reservadas = 3 where id = '51000000-0000-4000-8000-000000000003';

create temp table emitidos (rotulo text primary key, voucher_id uuid, codigo text, token text, repetido boolean);
grant all on emitidos to public;

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_tables where schemaname = 'public'
     and tablename in ('atividades', 'sessoes', 'vouchers', 'limites_requisicao') and rowsecurity),
  4, 'RLS ativa em atividades, sessoes, vouchers e limites_requisicao'
);
select is(
  (select count(*)::int from cron.job where jobname = 'expirar-vouchers'),
  1, 'pg_cron agenda a expiração de vouchers'
);
select ok(
  (select bool_and(privado.gerar_codigo_voucher() ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$') from generate_series(1, 200)),
  'código tem 12 caracteres do alfabeto sem 0, O, 1, I, L'
);

-- ---------------------------------------------------------------------------
-- Visitante anônimo
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.vouchers', '42501', null, 'anônimo não lê vouchers por consulta direta');
select throws_ok('select * from public.limites_requisicao', '42501', null, 'anônimo não lê limites de requisição');
select is(
  (select array_agg(titulo order by titulo) from public.atividades where municipio_id = '11000000-0000-4000-8000-000000000001'),
  array['Cachoeira livre', 'Trilha guiada'], 'anônimo vê só atividades publicadas'
);
select is(
  (select count(*)::int from public.sessoes where atividade_id = '41000000-0000-4000-8000-000000000002'),
  0, 'anônimo não vê sessões de atividade em rascunho'
);
select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001', null, 1, 'X', 'TO', null, null, gen_random_uuid())$$,
  '42501', null, 'anônimo não chama a emissão pública direto (só o servidor)'
);
select throws_ok(
  $$select public.consultar_voucher_token('11000000-0000-4000-8000-000000000001', repeat('a', 64))$$,
  '42501', null, 'anônimo não chama a consulta por token direto'
);
select throws_ok(
  $$select public.conferir_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH2')$$,
  '42501', null, 'anônimo não confere voucher'
);
select throws_ok(
  $$insert into public.atividades (municipio_id, titulo, modo) values ('11000000-0000-4000-8000-000000000001', 'Invasora', 'reserva')$$,
  '42501', null, 'anônimo não cria atividade'
);

reset role;

-- ---------------------------------------------------------------------------
-- Emissão pública (service_role, como o servidor)
-- ---------------------------------------------------------------------------

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into emitidos
select 'p1', * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001', null, 2, 'Gurupi', 'to', null, null, '71000000-0000-4000-8000-000000000001');

select ok((select codigo ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$' and not repetido from emitidos where rotulo = 'p1'),
  'emissão pública devolve código válido');
select is((select pessoas_reservadas from public.sessoes where id = '51000000-0000-4000-8000-000000000001'),
  2, 'emissão reserva as pessoas na sessão');

insert into emitidos
select 'p1-repetida', * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001', null, 2, 'Gurupi', 'TO', null, null, '71000000-0000-4000-8000-000000000001');

select ok(
  (select r.repetido and r.voucher_id = p.voucher_id and r.codigo = p.codigo
   from emitidos r, emitidos p where r.rotulo = 'p1-repetida' and p.rotulo = 'p1'),
  'mesma chave de idempotência devolve o mesmo voucher'
);
select is((select pessoas_reservadas from public.sessoes where id = '51000000-0000-4000-8000-000000000001'),
  2, 'repetição não reserva vagas de novo');
select is((select count(*)::int from public.vouchers where chave_idempotencia = '71000000-0000-4000-8000-000000000001'),
  1, 'repetição não cria outro voucher');
select ok(
  (select v.token_hash = sha256(decode(e.token, 'hex')) and length(e.token) = 64
   from public.vouchers v join emitidos e on e.voucher_id = v.id where e.rotulo = 'p1-repetida'),
  'banco guarda só o hash SHA-256 do token de 32 bytes (o mais recente vale)'
);
select is(
  public.consultar_voucher_token('11000000-0000-4000-8000-000000000001', (select token from emitidos where rotulo = 'p1')),
  null, 'o token anterior deixa de valer após a repetição'
);
select is(
  public.consultar_voucher_token('11000000-0000-4000-8000-000000000001', (select token from emitidos where rotulo = 'p1-repetida')) ->> 'codigo',
  (select codigo from emitidos where rotulo = 'p1'), 'consulta pelo token devolve o voucher'
);
select ok(
  not (public.consultar_voucher_token('11000000-0000-4000-8000-000000000001', (select token from emitidos where rotulo = 'p1-repetida')) ? 'contato'),
  'consulta pelo token não devolve contato'
);
select is(public.consultar_voucher_token('11000000-0000-4000-8000-000000000001', encode(extensions.gen_random_bytes(32), 'hex')),
  null, 'token errado: mesma resposta de inexistente (null)');
select is(public.consultar_voucher_token('11000000-0000-4000-8000-000000000001', 'nao-e-token'),
  null, 'token malformado: mesma resposta (null)');
select is(public.consultar_voucher_token('11000000-0000-4000-8000-000000000002', (select token from emitidos where rotulo = 'p1-repetida')),
  null, 'token de outro município: mesma resposta (null)');

select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001', null, 11, 'Gurupi', 'TO', null, null, gen_random_uuid())$$,
  'P0001', 'quantidade_invalida', 'acima do máximo por voucher é recusado'
);
select lives_ok(
  $$insert into emitidos select 'p2', * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', null, 10, 'Palmas', 'TO', null, null, gen_random_uuid())$$,
  'chega a 12 de 15 vagas'
);
select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001', null, 4, 'Gurupi', 'TO', null, null, gen_random_uuid())$$,
  'P0001', 'sem_vagas', 'sem vagas para 4 pessoas quando restam 3'
);
select is((select pessoas_reservadas from public.sessoes where id = '51000000-0000-4000-8000-000000000001'),
  12, 'emissão recusada não altera as vagas');
select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002',
    '51000000-0000-4000-8000-000000000004', null, 1, 'Gurupi', 'TO', null, null, gen_random_uuid())$$,
  'P0001', 'atividade_indisponivel', 'atividade em rascunho não emite'
);
select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000003', null, 1, 'Gurupi', 'TO', null, null, gen_random_uuid())$$,
  'P0001', 'sessao_indisponivel', 'sessão passada não emite'
);
select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001', null, 1, 'Gurupi', 'TO', null, null, gen_random_uuid())$$,
  'P0001', 'atividade_indisponivel', 'atividade de A não emite pelo município B'
);
select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000003',
    null, privado.hoje_local(), 2, 'Gurupi', 'TO', null, null, gen_random_uuid())$$,
  'P0001', 'responsavel_obrigatorio', 'registro que exige responsável recusa sem nome'
);
select throws_ok(
  $$select * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000003',
    null, privado.hoje_local() - 1, 2, 'Gurupi', 'TO', 'Ana', null, gen_random_uuid())$$,
  'P0001', 'data_invalida', 'registro voluntário não aceita data passada'
);
insert into emitidos
select 'r1', * from public.emitir_voucher_publico('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000003',
  null, privado.hoje_local(), 3, 'Peixe', 'TO', 'Ana', '63 99999-0000', gen_random_uuid());
select ok(
  (select v.sessao_id is null and v.nome_responsavel = 'Ana' and v.contato is null and v.data_visita = privado.hoje_local()
   from public.vouchers v join emitidos e on e.voucher_id = v.id where e.rotulo = 'r1'),
  'registro voluntário: sem sessão, guarda o nome exigido e descarta o contato não exigido (D10)'
);

-- Cancelamento pelo token devolve exatamente as pessoas do voucher
select is(
  public.cancelar_voucher_token('11000000-0000-4000-8000-000000000001', (select token from emitidos where rotulo = 'p2')) ->> 'resultado',
  'cancelado', 'visitante cancela pelo token'
);
select is((select pessoas_reservadas from public.sessoes where id = '51000000-0000-4000-8000-000000000001'),
  2, 'cancelamento devolve exatamente as 10 pessoas do voucher');
select is(
  public.cancelar_voucher_token('11000000-0000-4000-8000-000000000001', (select token from emitidos where rotulo = 'p2')) ->> 'resultado',
  'nao_cancelavel', 'cancelar de novo não devolve vagas outra vez'
);
select is((select pessoas_reservadas from public.sessoes where id = '51000000-0000-4000-8000-000000000001'),
  2, 'vagas continuam corretas após o segundo cancelamento');
select is(
  public.cancelar_voucher_token('11000000-0000-4000-8000-000000000001', encode(extensions.gen_random_bytes(32), 'hex')) ->> 'resultado',
  'nao_encontrado', 'cancelar com token errado: não encontrado'
);
select throws_ok(
  $$select public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH2', 1)$$,
  '42501', null, 'service_role não confirma voucher (confirmação usa a sessão do operador)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Operador de A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is((select count(*)::int from public.vouchers), 0, 'operador não lê a tabela vouchers');
select is(
  public.conferir_voucher('11000000-0000-4000-8000-000000000001', 'hhhh-hhhh-hhh2') -> 'voucher' ->> 'pessoas',
  '4', 'operador confere pelo código (aceita minúsculas e hífens)'
);
select ok(
  not (public.conferir_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH2') -> 'voucher' ?| array['nome_responsavel', 'contato', 'token_hash', 'chave_idempotencia']),
  'conferência devolve só os campos necessários (sem nome, contato ou token)'
);
select throws_ok(
  $$select public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH2', 5)$$,
  'P0001', 'quantidade_invalida', 'não confirma mais pessoas que as do voucher'
);
select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH2', 3) ->> 'resultado',
  'confirmado', 'operador confirma 3 de 4 pessoas'
);
reset role;
select ok(
  (select status = 'utilizado' and pessoas_atendidas = 3 and utilizado_por = '21000000-0000-4000-8000-000000000003' and utilizado_em is not null
   from public.vouchers where id = '61000000-0000-4000-8000-000000000001'),
  'confirmação grava quantidade, horário e operador'
);
create temp table antes_repeticao as
  select utilizado_em, pessoas_atendidas, (select count(*) from public.auditoria where registro_id = '61000000-0000-4000-8000-000000000001') as aud
  from public.vouchers where id = '61000000-0000-4000-8000-000000000001';
grant all on antes_repeticao to public;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH2', 1) ->> 'resultado',
  'ja_utilizado', 'confirmação repetida devolve já utilizado'
);
select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH2', 4) -> 'voucher' ->> 'utilizado_por_nome',
  'Operadora A', 'já utilizado informa quem confirmou'
);
reset role;
select ok(
  (select v.utilizado_em = a.utilizado_em and v.pessoas_atendidas = a.pessoas_atendidas
     and (select count(*) from public.auditoria where registro_id = '61000000-0000-4000-8000-000000000001') = a.aud
   from public.vouchers v, antes_repeticao a where v.id = '61000000-0000-4000-8000-000000000001'),
  'confirmação repetida não altera contagem, horário nem gera auditoria'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(
  public.cancelar_voucher_painel('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH3') ->> 'resultado',
  'cancelado', 'operador cancela pelo painel'
);
select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH3', 1) ->> 'resultado',
  'cancelado', 'voucher cancelado é rejeitado'
);
select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH4', 1) ->> 'resultado',
  'expirado', 'voucher de sessão encerrada há mais de 2 h é rejeitado como expirado'
);
select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH5', 1) ->> 'resultado',
  'fora_do_dia', 'voucher de outro dia não é confirmado'
);
select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'ZZZZZZZZZZZZ', 1) ->> 'resultado',
  'nao_encontrado', 'código inexistente'
);
select throws_ok(
  $$update public.vouchers set status = 'utilizado'$$,
  '42501', null, 'operador não altera vouchers diretamente'
);
select results_eq(
  $$with u as (update public.atividades set titulo = 'Alterada pelo operador' returning 1) select count(*)::int from u$$,
  $$values (0)$$, 'operador não altera atividades'
);
select throws_ok(
  $$select public.relatorio_vouchers('11000000-0000-4000-8000-000000000001', current_date - 30, current_date)$$,
  'P0001', 'sem_permissao', 'operador não vê o relatório'
);
insert into emitidos (rotulo, voucher_id, codigo, repetido)
select 'a1', * from public.emitir_voucher_assistido('11000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001', null, 1, 'Arraias', 'TO', null, null, gen_random_uuid());

reset role;
select ok(
  (select v.origem = 'assistida' and v.emitido_por = '21000000-0000-4000-8000-000000000003'
   from public.vouchers v join emitidos e on e.voucher_id = v.id where e.rotulo = 'a1'),
  'emissão assistida grava origem e operador'
);
select ok(
  exists (select 1 from public.auditoria where tabela = 'vouchers' and operacao = 'UPDATE'
          and registro_id = '61000000-0000-4000-8000-000000000001'
          and usuario_id = '21000000-0000-4000-8000-000000000003' and depois ->> 'status' = 'utilizado'),
  'auditoria registra a confirmação com o operador'
);
select ok(
  not exists (select 1 from public.auditoria where tabela = 'vouchers'
              and (coalesce(antes, '{}') ?| array['nome_responsavel', 'contato', 'token_hash']
                   or coalesce(depois, '{}') ?| array['nome_responsavel', 'contato', 'token_hash'])),
  'auditoria de vouchers não copia nome, contato nem token'
);
select ok(
  exists (select 1 from public.auditoria where tabela = 'vouchers' and operacao = 'INSERT'
          and usuario_id = '21000000-0000-4000-8000-000000000003' and depois ->> 'origem' = 'assistida'),
  'auditoria registra a emissão assistida'
);

-- ---------------------------------------------------------------------------
-- Gestor de B: nada de A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select is(
  public.confirmar_voucher('11000000-0000-4000-8000-000000000002', 'HHHHHHHHHHH5', 1),
  '{"resultado": "outro_municipio"}'::jsonb, 'voucher de A é rejeitado em B como outro município, sem detalhes'
);
select throws_ok(
  $$select public.confirmar_voucher('11000000-0000-4000-8000-000000000001', 'HHHHHHHHHHH5', 1)$$,
  'P0001', 'sem_permissao', 'gestor de B não confirma informando o município A'
);
select is((select count(*)::int from public.vouchers), 0, 'gestor de B não lê vouchers de A');
select throws_ok(
  $$insert into public.atividades (municipio_id, titulo, modo) values ('11000000-0000-4000-8000-000000000001', 'Intrusa', 'reserva')$$,
  '42501', null, 'gestor de B não cria atividade em A'
);
select throws_ok(
  $$select public.relatorio_vouchers('11000000-0000-4000-8000-000000000001', current_date - 30, current_date)$$,
  'P0001', 'sem_permissao', 'gestor de B não vê relatório de A'
);

reset role;

-- ---------------------------------------------------------------------------
-- Gestor de A
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.atividades (municipio_id, titulo, modo) values
    ('11000000-0000-4000-8000-000000000001', 'Nova visita', 'reserva')$$,
  'gestor cria atividade'
);
select results_eq(
  $$with u as (update public.atividades set status = 'publicado' where titulo = 'Nova visita' returning 1)
    select count(*)::int from u$$,
  $$values (1)$$, 'gestor publica atividade'
);
select throws_ok(
  $$update public.sessoes set pessoas_reservadas = 0 where id = '51000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'gestor não altera pessoas_reservadas diretamente'
);
select throws_ok(
  $$update public.sessoes set capacidade_pessoas = 1 where id = '51000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'capacidade não fica abaixo das pessoas reservadas'
);
select throws_ok(
  $$insert into public.sessoes (municipio_id, atividade_id, inicio, fim) values ('11000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000003', now() + interval '1 day', now() + interval '1 day 1 hour')$$,
  'P0001', 'sessao_so_em_reserva', 'registro voluntário não tem sessões'
);
select is((select count(*)::int from public.vouchers), 8, 'gestor lê os vouchers do seu município');
select ok(
  exists (select 1 from public.auditoria where tabela = 'atividades' and operacao = 'UPDATE'
          and depois ->> 'titulo' = 'Nova visita' and depois ->> 'status' = 'publicado' and usuario_id = '21000000-0000-4000-8000-000000000002'),
  'auditoria registra a alteração de atividade com o gestor'
);

reset role;

-- ---------------------------------------------------------------------------
-- Expiração em lote
-- ---------------------------------------------------------------------------

select is(privado.expirar_vouchers(), 0, 'nada mais a expirar (o vencido já expirou na conferência)');
update public.vouchers set status = 'emitido', expirado_em = null where id = '61000000-0000-4000-8000-000000000003';
select is(privado.expirar_vouchers(), 1, 'rotina expira o voucher cuja sessão terminou há mais de 2 h');
select is(
  (select status from public.vouchers where id = '61000000-0000-4000-8000-000000000004'),
  'emitido', 'voucher de amanhã continua emitido'
);

select * from finish();
rollback;
