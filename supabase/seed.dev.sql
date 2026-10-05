-- DADOS FICTÍCIOS. Somente ambiente local (config.toml > db.seed). Nunca aplicar no projeto remoto.
--
-- Usuários [DEV] sem senha. Nenhuma senha fica no repositório: os testes E2E definem
-- uma senha aleatória a cada execução pela Admin API; para entrar manualmente, use
-- "Esqueci minha senha" em /admin/login e abra o e-mail no Mailpit (http://127.0.0.1:54324).

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-00000000a001'::uuid, 'admin@exemplo.test', '[DEV] Admin da assessoria'),
      ('00000000-0000-4000-8000-00000000a002'::uuid, 'gestor.palmeiropolis@exemplo.test', '[DEV] Gestor de Palmeirópolis'),
      ('00000000-0000-4000-8000-00000000a003'::uuid, 'operador.palmeiropolis@exemplo.test', '[DEV] Operador de Palmeirópolis'),
      ('00000000-0000-4000-8000-00000000a004'::uuid, 'gestor.peixe@exemplo.test', '[DEV] Gestor de Peixe')
    ) as t (id, email, nome)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now()
    ) on conflict (provider_id, provider) do nothing;

    -- O perfil é criado pelo trigger em auth.users.
    update public.perfis set nome = u.nome where user_id = u.id;
  end loop;
end;
$$;

update public.perfis set admin_assessoria = true
where user_id = '00000000-0000-4000-8000-00000000a001';

insert into public.vinculos (user_id, municipio_id, papel)
select v.user_id, m.id, v.papel
from (values
  ('00000000-0000-4000-8000-00000000a002'::uuid, 'palmeiropolis', 'gestor'),
  ('00000000-0000-4000-8000-00000000a003'::uuid, 'palmeiropolis', 'operador'),
  ('00000000-0000-4000-8000-00000000a004'::uuid, 'peixe', 'gestor')
) as v (user_id, slug, papel)
join public.municipios m on m.slug = v.slug
on conflict (user_id, municipio_id) do nothing;
