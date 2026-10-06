-- Nenhuma função security definer do schema public pode ser executada por anon ou
-- authenticated (viraria endpoint RPC com os privilégios do dono). As regras ficam em
-- privado; em public só há invólucros security invoker (PLANO, Decisões).
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'anon não executa nenhuma função security definer em public'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0,
  'authenticated não executa nenhuma função security definer em public'
);

-- Reproduz a função que o Supabase cria em projetos novos e aplica a mesma revogação da
-- migration revogar_rls_auto_enable: depois dela, nem anon nem authenticated executam.
create function public.rls_auto_enable() returns event_trigger language plpgsql security definer
  set search_path = '' as $$ begin end $$;
grant execute on function public.rls_auto_enable() to anon, authenticated;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
select ok(
  not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE'),
  'a revogação tira o EXECUTE de anon e authenticated em rls_auto_enable'
);

select * from finish();
rollback;
