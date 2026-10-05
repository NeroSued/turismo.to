-- Fase 3: relatórios, evidências, histórico de alterações e minuta.
-- Roda com `npm run test:db` no banco local. Tudo é desfeito no rollback.
begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- Dados: município A (como Palmeirópolis) e B (como Peixe)
-- ---------------------------------------------------------------------------

insert into public.municipios (id, slug, nome, ativo) values
  ('13000000-0000-4000-8000-00000000000a', 'evida', 'Evidência A', true),
  ('13000000-0000-4000-8000-00000000000b', 'evidb', 'Evidência B', true);

insert into auth.users (id, email, aud, role) values
  ('23000000-0000-4000-8000-000000000001', 'admin@e.test', 'authenticated', 'authenticated'),
  ('23000000-0000-4000-8000-000000000002', 'gestora@e.test', 'authenticated', 'authenticated'),
  ('23000000-0000-4000-8000-000000000003', 'operadora@e.test', 'authenticated', 'authenticated'),
  ('23000000-0000-4000-8000-000000000004', 'gestorb@e.test', 'authenticated', 'authenticated');

update public.perfis set admin_assessoria = true where user_id = '23000000-0000-4000-8000-000000000001';
update public.perfis set nome = 'Gestora A' where user_id = '23000000-0000-4000-8000-000000000002';

insert into public.vinculos (user_id, municipio_id, papel) values
  ('23000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-00000000000a', 'gestor'),
  ('23000000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-00000000000a', 'operador'),
  ('23000000-0000-4000-8000-000000000004', '13000000-0000-4000-8000-00000000000b', 'gestor');

insert into public.prestadores (id, municipio_id, nome_publico, categoria, situacao_rede, status) values
  ('53000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-00000000000a', 'Guia A', 'guias', 'participante', 'publicado'),
  ('53000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-00000000000b', 'Guia B', 'guias', 'participante', 'publicado');

insert into public.atividades (id, municipio_id, titulo, modo, status, prestador_id) values
  ('63000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-00000000000a', 'Trilha A', 'registro_voluntario', 'publicado',
   '53000000-0000-4000-8000-000000000001'),
  ('63000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-00000000000b', 'Trilha B', 'registro_voluntario', 'publicado', null);

-- Registros voluntários de A (emitidos como o servidor faz, com a função da Fase 1).
select privado.emitir_voucher_publico('13000000-0000-4000-8000-00000000000a', '63000000-0000-4000-8000-000000000001', null,
  privado.hoje_local(), 2, 'Gurupi', 'TO', null, null, gen_random_uuid());
select privado.emitir_voucher_publico('13000000-0000-4000-8000-00000000000a', '63000000-0000-4000-8000-000000000001', null,
  privado.hoje_local(), 3, 'Gurupi', 'TO', null, null, gen_random_uuid());
select privado.emitir_voucher_publico('13000000-0000-4000-8000-00000000000a', '63000000-0000-4000-8000-000000000001', null,
  privado.hoje_local(), 1, 'Goiânia', 'GO', null, null, gen_random_uuid());

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_tables where schemaname = 'public'
     and tablename in ('evidencias', 'evidencias_arquivos', 'evidencias_historico', 'minutas_relatorio') and rowsecurity),
  4, 'RLS ativa em evidencias, evidencias_arquivos, evidencias_historico e minutas_relatorio'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.proname in ('preparar_evidencia', 'preparar_minuta', 'nome_do_autor',
     'historico_evidencia', 'historico_arquivo_evidencia', 'relatorio_completo')
     and p.prosecdef and p.proconfig @> array['search_path=""']),
  6, 'funções security definer da fase com search_path vazio'
);
select ok(
  not has_function_privilege('anon', 'public.relatorio_completo(uuid, date, date)', 'execute'),
  'anônimo não executa relatorio_completo'
);

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.evidencias', '42501', null, 'anônimo não lê evidências');
select throws_ok('select * from public.evidencias_arquivos', '42501', null, 'anônimo não lê arquivos de evidência');
select throws_ok('select * from public.evidencias_historico', '42501', null, 'anônimo não lê o histórico');
select throws_ok('select * from public.minutas_relatorio', '42501', null, 'anônimo não lê minutas');
select throws_ok(
  $$select public.relatorio_completo('13000000-0000-4000-8000-00000000000a', current_date - 30, current_date)$$,
  '42501', null, 'anônimo não obtém relatório'
);

reset role;

-- ---------------------------------------------------------------------------
-- Gestor de A: cria, edita, anexa; histórico com autor e horário
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.evidencias (municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel, atividade_id)
    values ('13000000-0000-4000-8000-00000000000a', 2026, 'capacitacao',
            'Oficina de condutores', 'Oficina com condutores locais sobre segurança em trilhas.', privado.hoje_local() - 10,
            'Secretaria de Turismo', '63000000-0000-4000-8000-000000000001')$$,
  'gestor de A registra evidência'
);
select set_config('teste.evid', (select id::text from public.evidencias where titulo = 'Oficina de condutores'), false);
select is(
  (select row(criado_por, criado_em is not null, data_realizacao <> criado_em::date)::text
   from public.evidencias where id = current_setting('teste.evid')::uuid),
  row('23000000-0000-4000-8000-000000000002'::uuid, true, true)::text,
  'autoria e data de inclusão automáticas, separadas da data de realização'
);
select throws_ok(
  $$insert into public.evidencias (municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel)
    values ('13000000-0000-4000-8000-00000000000a', 2026, 'reuniao', 'Reunião futura', 'Ainda não aconteceu, não é evidência.',
            privado.hoje_local() + 1, 'Secretaria')$$,
  'P0001', 'data_futura', 'data de realização futura é recusada'
);
select throws_ok(
  $$insert into public.evidencias (municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel, criado_por)
    values ('13000000-0000-4000-8000-00000000000a', 2026, 'reuniao', 'Autoria forjada', 'Tentativa de gravar outra autoria.',
            privado.hoje_local(), 'Secretaria', '23000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'gestor não grava a autoria de outra pessoa'
);
select is(
  (select row(acao, autor_id, autor_nome)::text from public.evidencias_historico
   where evidencia_id = current_setting('teste.evid')::uuid),
  row('criada', '23000000-0000-4000-8000-000000000002'::uuid, 'Gestora A')::text,
  'criação registrada no histórico com autor'
);

update public.evidencias set descricao = 'Oficina com 18 condutores locais sobre segurança em trilhas.', responsavel = 'Sec. de Turismo'
where id = current_setting('teste.evid')::uuid;

select is(
  (select row(acao, campos, autor_id, autor_nome, em is not null)::text from public.evidencias_historico
   where evidencia_id = current_setting('teste.evid')::uuid and acao = 'editada'),
  row('editada', array['descricao', 'responsavel'], '23000000-0000-4000-8000-000000000002'::uuid, 'Gestora A', true)::text,
  'edição gera registro no histórico com campos, autor e horário'
);
select is(
  (select antes ->> 'responsavel' || ' -> ' || (depois ->> 'responsavel') from public.evidencias_historico
   where evidencia_id = current_setting('teste.evid')::uuid and acao = 'editada'),
  'Secretaria de Turismo -> Sec. de Turismo',
  'histórico guarda o valor anterior e o novo'
);
select is(
  (select atualizado_por from public.evidencias where id = current_setting('teste.evid')::uuid),
  '23000000-0000-4000-8000-000000000002'::uuid,
  'evidência guarda quem alterou por último'
);

update public.evidencias set titulo = titulo where id = current_setting('teste.evid')::uuid;
select is(
  (select count(*)::int from public.evidencias_historico where evidencia_id = current_setting('teste.evid')::uuid),
  2, 'salvar sem mudar nada não cria registro'
);

select lives_ok(
  $$insert into public.evidencias_arquivos (municipio_id, evidencia_id, tipo, caminho, legenda, mime, tamanho)
    values ('13000000-0000-4000-8000-00000000000a', current_setting('teste.evid')::uuid, 'lista_presenca',
            '13000000-0000-4000-8000-00000000000a/evidencias/lista.pdf', 'Lista de presença da oficina', 'application/pdf', 1000)$$,
  'gestor de A anexa lista de presença'
);
select throws_ok(
  $$insert into public.evidencias_arquivos (municipio_id, evidencia_id, tipo, caminho, legenda, mime, tamanho)
    values ('13000000-0000-4000-8000-00000000000a', current_setting('teste.evid')::uuid, 'foto',
            '13000000-0000-4000-8000-00000000000a/evidencias/foto.pdf', 'Foto que é PDF', 'application/pdf', 1000)$$,
  '23514', null, 'foto de evidência precisa ser JPEG ou PNG'
);
select throws_ok(
  $$insert into public.evidencias_arquivos (municipio_id, evidencia_id, tipo, caminho, legenda, mime, tamanho)
    values ('13000000-0000-4000-8000-00000000000a', current_setting('teste.evid')::uuid, 'ata',
            '13000000-0000-4000-8000-00000000000b/evidencias/ata.pdf', 'Ata em outra pasta', 'application/pdf', 1000)$$,
  '23514', null, 'arquivo fora da pasta do município é recusado'
);
update public.evidencias_arquivos set legenda = 'Lista de presença assinada pelos participantes'
where evidencia_id = current_setting('teste.evid')::uuid;
-- Fase 4.5: o gestor retira o anexo (o arquivo fica guardado); apagar de vez é só do admin.
update public.evidencias_arquivos set retirado = true where evidencia_id = current_setting('teste.evid')::uuid;
select results_eq(
  $$select acao from public.evidencias_historico where evidencia_id = current_setting('teste.evid')::uuid order by id$$,
  $$values ('criada'::text), ('editada'), ('arquivo_incluido'), ('legenda_alterada'), ('arquivo_removido')$$,
  'inclusão, troca de legenda e remoção de anexo entram no histórico'
);
update public.evidencias set arquivada = true where id = current_setting('teste.evid')::uuid;
select is(
  (select acao from public.evidencias_historico where evidencia_id = current_setting('teste.evid')::uuid order by id desc limit 1),
  'arquivada', 'arquivar entra no histórico'
);

select throws_ok(
  $$insert into public.evidencias_historico (municipio_id, evidencia_id, acao) values
    ('13000000-0000-4000-8000-00000000000a', current_setting('teste.evid')::uuid, 'editada')$$,
  '42501', null, 'ninguém grava o histórico diretamente'
);
select throws_ok(
  $$delete from public.evidencias_historico$$, '42501', null, 'ninguém apaga o histórico'
);
select throws_ok(
  $$delete from public.evidencias where id = current_setting('teste.evid')::uuid$$,
  '42501', null, 'evidência não é excluída (é arquivada)'
);
select throws_ok(
  $$update public.evidencias set criado_em = now() - interval '1 year' where id = current_setting('teste.evid')::uuid$$,
  '42501', null, 'data de inclusão não é alterável'
);
select throws_ok(
  $$insert into public.evidencias (municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel, atividade_id)
    values ('13000000-0000-4000-8000-00000000000a', 2026, 'evento', 'Atividade de B', 'Evidência ligada a atividade de outro município.',
            privado.hoje_local(), 'Secretaria', '63000000-0000-4000-8000-000000000002')$$,
  '23503', null, 'evidência não aponta para atividade de outro município'
);

select lives_ok(
  $$insert into public.minutas_relatorio (municipio_id, ano_base, metodologia) values
    ('13000000-0000-4000-8000-00000000000a', 2026, 'Dados do painel e listas de presença.')$$,
  'gestor de A salva a metodologia da minuta'
);
select is(
  (select atualizado_por from public.minutas_relatorio where municipio_id = '13000000-0000-4000-8000-00000000000a'),
  '23000000-0000-4000-8000-000000000002'::uuid, 'minuta guarda quem alterou'
);

select is(
  (select row((r -> 'origem' -> 0 ->> 'cidade'), (r -> 'origem' -> 0 ->> 'vouchers'), (r -> 'origem' -> 0 ->> 'pessoas'),
              jsonb_array_length(r -> 'origem'))::text
   from (select public.relatorio_completo('13000000-0000-4000-8000-00000000000a', privado.hoje_local() - 1, privado.hoje_local()) r) t),
  row('Gurupi', '2', '5', 2)::text,
  'relatório agrupa a origem por cidade e UF'
);
select is(
  (select row(r -> 'prestadores' -> 0 ->> 'nome', r -> 'prestadores' -> 0 ->> 'vouchers', r -> 'rede' ->> 'participantes')::text
   from (select public.relatorio_completo('13000000-0000-4000-8000-00000000000a', privado.hoje_local() - 1, privado.hoje_local()) r) t),
  row('Guia A', '3', '1')::text,
  'relatório lista o prestador envolvido e a rede'
);
select is(
  (select (public.relatorio_completo('13000000-0000-4000-8000-00000000000a', privado.hoje_local() - 1, privado.hoje_local())
           ->> 'registros_voluntarios')::int),
  3, 'relatório completo mantém os números da Fase 1'
);

-- ---------------------------------------------------------------------------
-- Operador de A: nada de relatórios nem evidências
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is((select count(*)::int from public.evidencias), 0, 'operador não vê evidências');
select is((select count(*)::int from public.evidencias_historico), 0, 'operador não vê o histórico');
select throws_ok(
  $$select public.relatorio_completo('13000000-0000-4000-8000-00000000000a', current_date - 30, current_date)$$,
  'P0001', 'sem_permissao', 'operador não obtém o relatório'
);

-- ---------------------------------------------------------------------------
-- Gestor de B: isolado de A
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select throws_ok(
  $$select public.relatorio_completo('13000000-0000-4000-8000-00000000000a', current_date - 30, current_date)$$,
  'P0001', 'sem_permissao', 'gestor de B não obtém o relatório de A'
);
select is((select count(*)::int from public.evidencias where municipio_id = '13000000-0000-4000-8000-00000000000a'), 0,
  'gestor de B não vê evidências de A');
select is((select count(*)::int from public.evidencias_historico where municipio_id = '13000000-0000-4000-8000-00000000000a'), 0,
  'gestor de B não vê o histórico de A');
select is((select count(*)::int from public.minutas_relatorio where municipio_id = '13000000-0000-4000-8000-00000000000a'), 0,
  'gestor de B não vê a minuta de A');
select throws_ok(
  $$insert into public.evidencias (municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel)
    values ('13000000-0000-4000-8000-00000000000a', 2026, 'reuniao', 'Invasão', 'Evidência gravada por outro município.',
            privado.hoje_local(), 'Gestor B')$$,
  '42501', null, 'gestor de B não registra evidência em A'
);
update public.evidencias set titulo = 'Alterado por B' where id = current_setting('teste.evid')::uuid;
update public.minutas_relatorio set analise = 'Alterado por B' where municipio_id = '13000000-0000-4000-8000-00000000000a';

reset role;
select is((select titulo from public.evidencias where id = current_setting('teste.evid')::uuid), 'Oficina de condutores',
  'a alteração de B não chegou à evidência de A');
select is((select analise from public.minutas_relatorio where municipio_id = '13000000-0000-4000-8000-00000000000a'), null,
  'a alteração de B não chegou à minuta de A');
select is((select count(*)::int from public.evidencias_historico where evidencia_id = current_setting('teste.evid')::uuid
           and autor_id = '23000000-0000-4000-8000-000000000004'), 0,
  'nenhum registro de B no histórico de A');

-- Storage: gestor de B não lê nem grava na pasta de evidências de A
insert into storage.objects (bucket_id, name) values ('interno', '13000000-0000-4000-8000-00000000000a/evidencias/lista.pdf');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where name like '13000000-0000-4000-8000-00000000000a/evidencias/%'), 0,
  'gestor de B não lista os arquivos de evidência de A');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('interno', '13000000-0000-4000-8000-00000000000a/evidencias/b.pdf')$$,
  '42501', null, 'gestor de B não grava na pasta de evidências de A'
);
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where name like '13000000-0000-4000-8000-00000000000a/evidencias/%'), 1,
  'gestor de A lê os arquivos de evidência de A');

-- Admin da assessoria passa
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.evidencias where municipio_id = '13000000-0000-4000-8000-00000000000a'), 1,
  'admin da assessoria vê as evidências de A');

reset role;
select * from finish();
rollback;
