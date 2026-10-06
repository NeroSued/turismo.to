-- O Supabase cria public.rls_auto_enable() (security definer) e o gatilho de evento
-- ensure_rls quando o projeto nasce com "habilitar RLS automaticamente". A função fica
-- em public com EXECUTE para anon e authenticated, ou seja, vira um endpoint RPC
-- (advisors anon/authenticated_security_definer_function_executable). O gatilho de
-- evento não depende desse EXECUTE, então ele continua funcionando.
-- Só existe em projetos criados assim: no banco local a migration não faz nada.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
