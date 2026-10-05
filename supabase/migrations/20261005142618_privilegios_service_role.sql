-- Os triggers de perfis, vinculos, municipios e configuracoes chamam funções do schema
-- privado. Operações privilegiadas (PLANO, D8), como o script criar-admin, rodam como
-- service_role e precisam de acesso a esse schema para que os triggers executem.
grant usage on schema privado to service_role;
grant execute on function privado.eh_admin() to service_role;
grant execute on function privado.tem_papel(uuid, text[]) to service_role;

-- Os privilégios padrão do Supabase dão tudo ao service_role em tabelas novas.
-- A auditoria só é escrita por trigger (security definer): ninguém grava ou apaga direto.
revoke insert, update, delete, truncate on table public.auditoria from service_role;
