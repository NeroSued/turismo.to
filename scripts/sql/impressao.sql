-- Impressão digital de cada tabela: quantidade de linhas e md5 do conteúdo ordenado.
select format(
  $f$select %L as tabela, count(*) as linhas, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as md5 from %I.%I t$f$,
  n.nspname || '.' || c.relname, n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and (n.nspname = 'public' or (n.nspname, c.relname) in (('auth', 'users'), ('auth', 'identities')))
order by 1
\gexec
-- Objetos do Storage: só bucket e caminho (o acesso e o reenvio mudam datas e metadados).
select 'storage.objects' as tabela, count(*) as linhas, md5(coalesce(string_agg(bucket_id || '/' || name, '|' order by bucket_id, name), '')) as md5
from storage.objects;
-- Buckets: configuração, sem as datas (recriados pelas migrations).
select 'storage.buckets' as tabela, count(*) as linhas,
  md5(coalesce(string_agg(concat_ws(',', id, name, public, file_size_limit, allowed_mime_types::text), '|' order by id), '')) as md5
from storage.buckets;
