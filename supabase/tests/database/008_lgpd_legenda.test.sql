-- Fase 5.9: exclusão LGPD substitui a legenda do arquivo nos registros do histórico (e da auditoria).
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into public.municipios (id, slug, nome, ativo) values
  ('18000000-0000-4000-8000-00000000000a', 'lgpda', 'LGPD A', true);

insert into auth.users (id, email, aud, role) values
  ('28000000-0000-4000-8000-000000000001', 'admin@l.test', 'authenticated', 'authenticated'),
  ('28000000-0000-4000-8000-000000000002', 'gestora@l.test', 'authenticated', 'authenticated');
update public.perfis set admin_assessoria = true, nome = 'Admin L' where user_id = '28000000-0000-4000-8000-000000000001';
update public.perfis set nome = 'Gestora L' where user_id = '28000000-0000-4000-8000-000000000002';
insert into public.vinculos (user_id, municipio_id, papel) values
  ('28000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-00000000000a', 'gestor');

insert into storage.objects (bucket_id, name) values
  ('interno', '18000000-0000-4000-8000-00000000000a/evidencias/oficina.jpg'),
  ('interno', '18000000-0000-4000-8000-00000000000a/evidencias/lista.pdf');

-- A gestora cria a evidência, inclui dois arquivos, corrige a legenda da foto e retira a foto.
-- (Superusuário com as claims da gestora: os triggers gravam a autoria dela e os ids ficam fixos.)
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.evidencias (id, municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel) values
  ('48000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-00000000000a', 2026, 'reuniao', 'Oficina de guias',
   'Oficina com moradores', date '2026-02-10', 'Secretaria');
insert into public.evidencias_arquivos (id, municipio_id, evidencia_id, tipo, caminho, legenda, mime, tamanho) values
  ('58000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-00000000000a', '48000000-0000-4000-8000-000000000001',
   'foto', '18000000-0000-4000-8000-00000000000a/evidencias/oficina.jpg', 'Beltrana Souza na oficina', 'image/jpeg', 1000),
  ('58000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-00000000000a', '48000000-0000-4000-8000-000000000001',
   'lista_presenca', '18000000-0000-4000-8000-00000000000a/evidencias/lista.pdf', 'Lista de presença da oficina', 'application/pdf', 1000);
update public.evidencias_arquivos set legenda = 'Beltrana Maria Souza ensinando na oficina'
where id = '58000000-0000-4000-8000-000000000001';
update public.evidencias_arquivos set retirado = true where id = '58000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', null, true);

-- Registro antigo, gravado antes da coluna arquivo_id existir (só legenda e evidência).
insert into public.evidencias_historico (municipio_id, evidencia_id, autor_nome, acao, antes)
values ('18000000-0000-4000-8000-00000000000a', '48000000-0000-4000-8000-000000000001', 'Gestora L', 'arquivo_removido',
        '{"tipo": "foto", "legenda": "Beltrana Maria Souza ensinando na oficina"}');

select is(
  (select count(*)::int from public.evidencias_historico
   where evidencia_id = '48000000-0000-4000-8000-000000000001'
     and (coalesce(antes::text, '') || coalesce(depois::text, '')) like '%Beltrana%'),
  4, 'antes da exclusão, 4 registros do histórico mostram a legenda com o nome da pessoa'
);
select is(
  (select count(*)::int from public.evidencias_historico where arquivo_id = '58000000-0000-4000-8000-000000000001'),
  3, 'inclusão, troca de legenda e retirada ficam ligadas ao arquivo'
);
select ok(
  (select count(*) > 0 from public.auditoria where tabela = 'evidencias_arquivos'
     and registro_id = '58000000-0000-4000-8000-000000000001' and (coalesce(antes::text, '') || coalesce(depois::text, '')) like '%Beltrana%'),
  'antes da exclusão, a auditoria do arquivo também tem a legenda'
);

-- O servidor apaga o objeto pela API do Storage com a sessão do admin (simulado aqui) e chama a função.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'interno' and name = '18000000-0000-4000-8000-00000000000a/evidencias/oficina.jpg';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select public.excluir_arquivo_evidencia_lgpd('58000000-0000-4000-8000-000000000001', 'Pedido da titular pela Ouvidoria')$$,
  'admin exclui a foto a pedido da titular'
);

-- A gestora lê o histórico como na tela da evidência.
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.evidencias_historico
   where evidencia_id = '48000000-0000-4000-8000-000000000001'
     and (coalesce(antes::text, '') || coalesce(depois::text, '')) like '%Beltrana%'),
  0, 'nenhum registro do histórico guarda mais o nome que estava na legenda'
);
select is(
  (select array_agg(acao || ': ' || coalesce(antes ->> 'legenda', '') || ' -> ' || coalesce(depois ->> 'legenda', '') order by id)
   from public.evidencias_historico
   where evidencia_id = '48000000-0000-4000-8000-000000000001' and (antes ? 'legenda' or depois ? 'legenda')
     and coalesce(arquivo_id, '58000000-0000-4000-8000-000000000001') = '58000000-0000-4000-8000-000000000001'),
  array[
    'arquivo_incluido:  -> [removido a pedido do titular]',
    'legenda_alterada: [removido a pedido do titular] -> [removido a pedido do titular]',
    'arquivo_removido: [removido a pedido do titular] -> ',
    'arquivo_removido: [removido a pedido do titular] -> '
  ],
  'a legenda vira "[removido a pedido do titular]" na inclusão, na troca de legenda, na retirada e no registro antigo'
);
select ok(
  (select autor_nome = 'Admin L' and autor_id = '28000000-0000-4000-8000-000000000001' and em is not null
          and antes = '{"tipo": "foto"}'::jsonb and depois = '{"motivo": "Pedido da titular pela Ouvidoria"}'::jsonb
          and arquivo_id = '58000000-0000-4000-8000-000000000001'
   from public.evidencias_historico where evidencia_id = '48000000-0000-4000-8000-000000000001' and acao = 'arquivo_excluido_lgpd'),
  'registro da exclusão mantém quem, quando, tipo e motivo'
);
select is(
  (select array_agg(autor_nome order by id) from public.evidencias_historico
   where arquivo_id = '58000000-0000-4000-8000-000000000001' and acao <> 'arquivo_excluido_lgpd'),
  array['Gestora L', 'Gestora L', 'Gestora L'],
  'autoria dos registros anteriores continua'
);
select is(
  (select depois ->> 'legenda' from public.evidencias_historico
   where arquivo_id = '58000000-0000-4000-8000-000000000002' and acao = 'arquivo_incluido'),
  'Lista de presença da oficina', 'a legenda do outro arquivo da evidência não muda'
);
reset role;

select is(
  (select count(*)::int from public.auditoria where tabela = 'evidencias_arquivos'
     and registro_id = '58000000-0000-4000-8000-000000000001' and (coalesce(antes::text, '') || coalesce(depois::text, '')) like '%Beltrana%'),
  0, 'auditoria do arquivo (inclusive a linha da exclusão) também sem a legenda'
);
select ok(
  (select bool_and(coalesce(antes ->> 'legenda', depois ->> 'legenda') = '[removido a pedido do titular]')
   from public.auditoria where tabela = 'evidencias_arquivos' and registro_id = '58000000-0000-4000-8000-000000000001'),
  'cada linha da auditoria do arquivo mostra "[removido a pedido do titular]"'
);
select is(
  (select count(*)::int from public.evidencias_arquivos where id = '58000000-0000-4000-8000-000000000001'),
  0, 'a linha do arquivo foi apagada'
);

select * from finish();
rollback;
