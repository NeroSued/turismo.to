-- Fase 4: escalada de privilégio, equipe, auditoria com filtros e exclusão LGPD de arquivo de evidência.
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

insert into public.municipios (id, slug, nome, ativo) values
  ('14000000-0000-4000-8000-00000000000a', 'admina', 'Admin A', true),
  ('14000000-0000-4000-8000-00000000000b', 'adminb', 'Admin B', true);

insert into auth.users (id, email, aud, role) values
  ('24000000-0000-4000-8000-000000000001', 'admin@f4.test', 'authenticated', 'authenticated'),
  ('24000000-0000-4000-8000-000000000002', 'gestora@f4.test', 'authenticated', 'authenticated'),
  ('24000000-0000-4000-8000-000000000003', 'operadora@f4.test', 'authenticated', 'authenticated'),
  ('24000000-0000-4000-8000-000000000004', 'gestorb@f4.test', 'authenticated', 'authenticated'),
  ('24000000-0000-4000-8000-000000000005', 'novo@f4.test', 'authenticated', 'authenticated');

update public.perfis set admin_assessoria = true, nome = 'Admin F4' where user_id = '24000000-0000-4000-8000-000000000001';
update public.perfis set nome = 'Gestora A' where user_id = '24000000-0000-4000-8000-000000000002';

insert into public.vinculos (id, user_id, municipio_id, papel) values
  ('34000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-00000000000a', 'gestor'),
  ('34000000-0000-4000-8000-000000000003', '24000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-00000000000a', 'operador'),
  ('34000000-0000-4000-8000-000000000004', '24000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-00000000000b', 'gestor');

insert into public.evidencias (id, municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel) values
  ('44000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-00000000000a', 2026, 'reuniao', 'Reunião com a comunidade',
   'Reunião de apresentação do roteiro', date '2026-01-10', 'Secretaria');
insert into public.evidencias_arquivos (id, municipio_id, evidencia_id, tipo, caminho, legenda, mime, tamanho) values
  ('54000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-00000000000a', '44000000-0000-4000-8000-000000000001',
   'foto', '14000000-0000-4000-8000-00000000000a/evidencias/rosto.jpg', 'Foto com Fulana de Tal', 'image/jpeg', 1000),
  ('54000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-00000000000a', '44000000-0000-4000-8000-000000000001',
   'ata', '14000000-0000-4000-8000-00000000000a/evidencias/ata.pdf', 'Ata da reunião', 'application/pdf', 1000);
-- Objeto correspondente no Storage (o servidor o apaga pela API do Storage antes de chamar a função).
insert into storage.objects (bucket_id, name) values ('interno', '14000000-0000-4000-8000-00000000000a/evidencias/rosto.jpg');

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname in ('equipe_do_municipio', 'usuario_por_email', 'admins_assessoria',
     'auditoria_consultar', 'auditoria_usuarios', 'excluir_arquivo_evidencia_lgpd', 'preparar_arquivo_evidencia',
     'arquivo_de_evidencia_em_uso')
     and p.prosecdef and p.proconfig @> array['search_path=""']),
  8, 'funções novas são security definer com search_path vazio'
);
select ok(
  not has_function_privilege('anon', 'public.excluir_arquivo_evidencia_lgpd(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.equipe_do_municipio(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.auditoria_consultar(uuid, uuid, date, date, text, text, bigint, integer)', 'execute'),
  'anônimo não executa as funções de administração'
);
select ok(
  not has_table_privilege('authenticated', 'public.evidencias_arquivos', 'delete'),
  'nenhum usuário apaga linhas de evidencias_arquivos diretamente'
);

-- ---------------------------------------------------------------------------
-- Gestora de A: equipe do próprio município, sem escalada
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$update public.perfis set admin_assessoria = true where user_id = '24000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'gestora não se promove a admin'
);
update public.perfis set admin_assessoria = true where user_id = '24000000-0000-4000-8000-000000000003';
update public.perfis set admin_assessoria = true where user_id = '24000000-0000-4000-8000-000000000005';
select throws_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel)
    values ('24000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-00000000000b', 'gestor')$$,
  '42501', null, 'gestora não cria vínculo em outro município'
);
select throws_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel)
    values ('24000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-00000000000b', 'gestor')$$,
  '42501', null, 'gestora não cria vínculo para si em outro município'
);
select throws_ok(
  $$update public.vinculos set user_id = '24000000-0000-4000-8000-000000000005' where id = '34000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'vínculo não troca de usuário'
);
select throws_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel, ativo)
    values ('24000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-00000000000a', 'operador', false)$$,
  '42501', null, 'colunas além de usuário, município e papel não são gravadas na inclusão'
);
select lives_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel)
    values ('24000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-00000000000a', 'operador')$$,
  'gestora cria vínculo de operador no próprio município'
);
update public.vinculos set papel = 'gestor' where id = '34000000-0000-4000-8000-000000000003';
update public.vinculos set ativo = false where user_id = '24000000-0000-4000-8000-000000000005';
-- O próprio vínculo e o vínculo de B: a RLS filtra (zero linhas), conferido abaixo.
update public.vinculos set papel = 'operador' where id = '34000000-0000-4000-8000-000000000002';
update public.vinculos set ativo = false where id = '34000000-0000-4000-8000-000000000004';
delete from public.vinculos where id = '34000000-0000-4000-8000-000000000003';

select is(
  (select count(*)::int from public.equipe_do_municipio('14000000-0000-4000-8000-00000000000a')),
  3, 'gestora lista a equipe do próprio município'
);
select ok(
  (select bool_and(email is not null) from public.equipe_do_municipio('14000000-0000-4000-8000-00000000000a')),
  'a equipe mostra o e-mail de cada pessoa'
);
select throws_ok(
  $$select * from public.equipe_do_municipio('14000000-0000-4000-8000-00000000000b')$$,
  'P0001', 'sem_permissao', 'gestora não lista a equipe de outro município'
);
select throws_ok(
  $$select public.usuario_por_email('novo@f4.test')$$,
  'P0001', 'sem_permissao', 'gestora não descobre contas pelo e-mail'
);
select throws_ok(
  $$select * from public.admins_assessoria()$$,
  'P0001', 'sem_permissao', 'gestora não lista os administradores'
);

reset role;

select ok(
  not (select admin_assessoria from public.perfis where user_id = '24000000-0000-4000-8000-000000000003')
  and not (select admin_assessoria from public.perfis where user_id = '24000000-0000-4000-8000-000000000005'),
  'gestora não promove outro usuário a admin'
);
select is(
  (select papel from public.vinculos where id = '34000000-0000-4000-8000-000000000003'),
  'gestor', 'gestora altera o papel de alguém da equipe'
);
select ok(
  not (select ativo from public.vinculos where user_id = '24000000-0000-4000-8000-000000000005'),
  'gestora desativa um vínculo do próprio município'
);
select is(
  (select papel from public.vinculos where id = '34000000-0000-4000-8000-000000000002'),
  'gestor', 'gestora não altera o próprio vínculo'
);
select ok(
  (select ativo from public.vinculos where id = '34000000-0000-4000-8000-000000000004'),
  'gestora não desativa vínculo de outro município'
);
select is(
  (select count(*)::int from public.vinculos where id = '34000000-0000-4000-8000-000000000003'),
  1, 'gestora não exclui vínculo (o caminho é desativar)'
);
select is(
  (select count(*)::int from public.vinculos where municipio_id = '14000000-0000-4000-8000-00000000000b'),
  1, 'nenhum vínculo novo em outro município'
);

-- ---------------------------------------------------------------------------
-- Operador: nada de equipe
-- ---------------------------------------------------------------------------

-- Volta o papel como o banco (sem usuário na sessão), para não contar como ação da gestora.
select set_config('request.jwt.claims', '', true);
update public.vinculos set papel = 'operador' where id = '34000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel)
    values ('24000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-00000000000a', 'operador')$$,
  '42501', null, 'operador não cria vínculo'
);
select throws_ok(
  $$select * from public.equipe_do_municipio('14000000-0000-4000-8000-00000000000a')$$,
  'P0001', 'sem_permissao', 'operador não lista a equipe'
);
select throws_ok(
  $$select * from public.auditoria_consultar('14000000-0000-4000-8000-00000000000a', null, date '2026-01-01', date '2100-01-01', null, null, null, 50)$$,
  'P0001', 'sem_permissao', 'operador não consulta a auditoria'
);
reset role;

-- ---------------------------------------------------------------------------
-- Auditoria com filtros
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
update public.configuracoes_municipio set nome_exibicao = 'Portal B' where municipio_id = '14000000-0000-4000-8000-00000000000b';
select throws_ok(
  $$select * from public.auditoria_consultar('14000000-0000-4000-8000-00000000000a', null, date '2026-01-01', date '2100-01-01', null, null, null, 50)$$,
  'P0001', 'sem_permissao', 'gestor de B não consulta a auditoria de A'
);
select throws_ok(
  $$select * from public.auditoria_consultar(null, null, date '2026-01-01', date '2100-01-01', null, null, null, 50)$$,
  'P0001', 'sem_permissao', 'gestor não consulta a auditoria de todos os municípios'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select ok(
  (select count(*) > 0 and bool_and(municipio_id = '14000000-0000-4000-8000-00000000000a')
   from public.auditoria_consultar('14000000-0000-4000-8000-00000000000a', null, privado.hoje_local(), privado.hoje_local(), null, null, null, 200)),
  'gestora de A vê só registros de A'
);
select results_eq(
  $$select count(*)::int, bool_and(tabela = 'vinculos' and operacao = 'UPDATE' and usuario_nome = 'Gestora A')
   from public.auditoria_consultar('14000000-0000-4000-8000-00000000000a', '24000000-0000-4000-8000-000000000002',
     privado.hoje_local(), privado.hoje_local(), 'vinculos', 'UPDATE', null, 200)$$,
  $$values (2, true)$$,
  'filtros por usuário, área e tipo de ação, com o nome do autor'
);
select ok(
  (select bool_or(campos = array['papel']) and bool_or(campos = array['ativo'])
   from public.auditoria_consultar('14000000-0000-4000-8000-00000000000a', null, privado.hoje_local(), privado.hoje_local(),
     'vinculos', 'UPDATE', null, 200)),
  'a auditoria mostra quais campos mudaram'
);
select is(
  (select count(*)::int from public.auditoria_consultar('14000000-0000-4000-8000-00000000000a', null,
     privado.hoje_local() - 30, privado.hoje_local() - 1, null, null, null, 200)),
  0, 'filtro por período exclui o que é de outro dia'
);
select throws_ok(
  $$select * from public.auditoria_consultar('14000000-0000-4000-8000-00000000000a', null, date '2026-02-01', date '2026-01-01', null, null, null, 50)$$,
  'P0001', 'periodo_invalido', 'período invertido é recusado'
);
select ok(
  exists (select 1 from public.auditoria_usuarios('14000000-0000-4000-8000-00000000000a') where nome = 'Gestora A'),
  'lista de pessoas para o filtro'
);
reset role;

-- ---------------------------------------------------------------------------
-- Arquivos de evidência: gestora retira; só o admin exclui de vez (LGPD)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$delete from public.evidencias_arquivos where id = '54000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'gestora não apaga arquivo de evidência'
);
select throws_ok(
  $$select public.excluir_arquivo_evidencia_lgpd('54000000-0000-4000-8000-000000000001', 'Pedido da titular por e-mail')$$,
  'P0001', 'sem_permissao', 'gestora não faz a exclusão LGPD'
);
update public.evidencias_arquivos set retirado = true where id = '54000000-0000-4000-8000-000000000002';
select throws_ok(
  $$update public.evidencias_arquivos set retirado = false where id = '54000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'arquivo retirado não volta'
);
reset role;

select ok(
  (select retirado and retirado_por = '24000000-0000-4000-8000-000000000002' and retirado_em is not null
   from public.evidencias_arquivos where id = '54000000-0000-4000-8000-000000000002'),
  'retirar guarda quem e quando, e mantém o arquivo'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$select public.excluir_arquivo_evidencia_lgpd('54000000-0000-4000-8000-000000000001', 'Pedido da titular por e-mail')$$,
  'P0001', 'sem_permissao', 'operadora não faz a exclusão LGPD'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select public.excluir_arquivo_evidencia_lgpd('54000000-0000-4000-8000-000000000001', 'curto')$$,
  'P0001', 'motivo_invalido', 'exclusão exige motivo'
);
select throws_ok(
  $$select public.excluir_arquivo_evidencia_lgpd('54000000-0000-4000-8000-000000000001', 'Pedido da titular por e-mail')$$,
  'P0001', 'arquivo_ainda_no_storage', 'exclusão só é registrada depois que o arquivo sai do Storage'
);
reset role;

-- O servidor apaga o objeto pela API do Storage com a sessão do admin (simulado aqui).
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'interno' and name = '14000000-0000-4000-8000-00000000000a/evidencias/rosto.jpg';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select public.excluir_arquivo_evidencia_lgpd('54000000-0000-4000-8000-000000000001', 'Pedido da titular por e-mail')$$,
  'admin exclui o arquivo a pedido do titular'
);
select ok(privado.eh_admin(), 'admin continua reconhecido');
select is(public.usuario_por_email('NOVO@f4.test'), '24000000-0000-4000-8000-000000000005'::uuid, 'admin encontra a conta pelo e-mail');
select ok(exists (select 1 from public.admins_assessoria() where email = 'admin@f4.test' and nome = 'Admin F4'), 'admin lista os administradores');
select ok(
  (select count(*) > 0 from public.auditoria_consultar(null, null, privado.hoje_local(), privado.hoje_local(), null, null, null, 200)),
  'admin consulta a auditoria de todos os municípios'
);
reset role;

select is(
  (select count(*)::int from public.evidencias_arquivos where id = '54000000-0000-4000-8000-000000000001'),
  0, 'a linha do arquivo é apagada'
);
select ok(
  (select autor_id = '24000000-0000-4000-8000-000000000001' and autor_nome = 'Admin F4' and em is not null
          and depois = '{"motivo": "Pedido da titular por e-mail"}'::jsonb and antes = '{"tipo": "foto"}'::jsonb
   from public.evidencias_historico where acao = 'arquivo_excluido_lgpd'),
  'histórico guarda quem, quando e o motivo, sem a legenda nem o arquivo'
);
select is(
  (select array_agg(acao order by id) from public.evidencias_historico where evidencia_id = '44000000-0000-4000-8000-000000000001'),
  array['criada', 'arquivo_incluido', 'arquivo_incluido', 'arquivo_removido', 'arquivo_excluido_lgpd'],
  'retirada e exclusão LGPD aparecem uma vez cada no histórico'
);

-- Conta pelo e-mail, como o servidor faz no convite (service_role, D8.4).
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.usuario_por_email('gestora@f4.test'), '24000000-0000-4000-8000-000000000002'::uuid,
  'servidor (service_role) encontra a conta no convite');
reset role;

select * from finish();
rollback;
