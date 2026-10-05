-- Operações privilegiadas (PLANO, D8) rodam como service_role: o script criar-admin
-- promove um perfil, e os triggers de proteção e auditoria precisam executar.
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, aud, role) values
  ('40000000-0000-4000-8000-000000000001', 'promovido@t.test', 'authenticated', 'authenticated');

set local role service_role;

select lives_ok(
  $$update public.perfis set admin_assessoria = true where user_id = '40000000-0000-4000-8000-000000000001'$$,
  'service_role promove um perfil a admin (script criar-admin)'
);

select lives_ok(
  $$insert into public.vinculos (user_id, municipio_id, papel)
    select '40000000-0000-4000-8000-000000000001', id, 'gestor' from public.municipios where slug = 'peixe'$$,
  'service_role cria vínculo'
);

select throws_ok(
  $$insert into public.auditoria (tabela, operacao) values ('x', 'INSERT')$$,
  '42501', null, 'service_role não grava diretamente na auditoria'
);

reset role;

select ok(
  exists (select 1 from public.auditoria
          where tabela = 'perfis' and operacao = 'UPDATE' and usuario_id is null
            and depois ->> 'admin_assessoria' = 'true'
            and registro_id = '40000000-0000-4000-8000-000000000001'),
  'a promoção pelo service_role fica na auditoria (sem usuário de sessão)'
);

select * from finish();
rollback;
