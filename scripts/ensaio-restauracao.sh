#!/usr/bin/env bash
# Ensaio de restauração de docs/BACKUP.md, SÓ no Supabase LOCAL (apaga e recria o banco local).
#   bash scripts/ensaio-restauracao.sh [pasta-da-copia]
# A pasta padrão fica fora do repositório (diretório temporário do sistema).
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BK="${1:-$(mktemp -d)/turismo-backup-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$BK"
caminho() { command -v cygpath >/dev/null && cygpath -w "$1" || echo "$1"; }
grep -q '^NEXT_PUBLIC_SUPABASE_URL=http://\(127\.0\.0\.1\|localhost\)' "$RAIZ/.env.local"   || { echo "Recusado: .env.local precisa apontar para o Supabase local (D11)."; exit 2; }
DB=supabase_db_turismo-to
psqlc() { docker exec -i $DB psql -U postgres -d postgres -q -t -A -F ' ' -v ON_ERROR_STOP=1 "$@"; }
cd "$RAIZ"

echo "== 1. Fotografia antes"
psqlc < "$RAIZ/scripts/sql/impressao.sql" > "$BK/antes.txt"
wc -l < "$BK/antes.txt" | sed 's/^/tabelas fotografadas: /'

echo "== 2. Cópia do banco (db dump: papéis, estrutura e dados)"
npx supabase db dump --local --role-only -f "$BK/roles.sql" 2>&1 | tail -1
npx supabase db dump --local -f "$BK/schema.sql" 2>&1 | tail -1
npx supabase db dump --local --data-only --use-copy -x storage.buckets -x storage.buckets_analytics -x storage.buckets_vectors -x storage.iceberg_namespaces -x storage.iceberg_tables -x storage.vector_indexes -x storage.s3_multipart_uploads -x storage.s3_multipart_uploads_parts -x supabase_functions.hooks -f "$BK/data.sql" 2>&1 | tail -1
ls -la "$BK"/*.sql | awk '{print $5, $NF}'

echo "== 3. Cópia do Storage"
npm run -s backup:storage -- exportar "$(caminho "$BK/storage")"

echo "== 4. Desastre simulado: banco zerado (só migrations) e 2 arquivos apagados do Storage"
read -r B1 N1 <<<"$(psqlc -c "select bucket_id, name from storage.objects where bucket_id = 'publico' order by name limit 1")"
read -r B2 N2 <<<"$(psqlc -c "select bucket_id, name from storage.objects where bucket_id = 'interno' order by name limit 1")"
node --env-file=.env.local -e '
  const { createClient } = require("@supabase/supabase-js");
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
  const [b1, n1, b2, n2] = process.argv.slice(1);
  (async () => {
    for (const [b, n] of [[b1, n1], [b2, n2]]) {
      const { error } = await s.storage.from(b).remove([n]);
      if (error) throw error;
      const d = await s.storage.from(b).download(n);
      console.log("apagado pela API: " + b + "/" + n.replace(/^[^/]+\//, "<municipio>/") + (d.error ? " (download agora falha)" : " (AINDA EXISTE)"));
    }
  })().catch((e) => { console.error(e.message); process.exit(1); });
' "$B1" "$N1" "$B2" "$N2"
npx supabase db reset --no-seed 2>&1 | tail -1
psqlc -c "select 'depois do desastre: ' || (select count(*) from public.municipios) || ' municípios, ' || (select count(*) from public.vouchers) || ' vouchers, ' || (select count(*) from auth.users) || ' contas, ' || (select count(*) from storage.objects) || ' objetos'"

echo "== 5. Restauração dos dados (session_replication_role = replica: sem disparar triggers)"
{ echo "set session_replication_role = replica;"; cat "$BK/data.sql"; } | docker exec -i $DB psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 --single-transaction > "$BK/restauracao.log" 2>&1 \
  && echo "data.sql aplicado sem erro" || { echo "FALHOU:"; tail -20 "$BK/restauracao.log"; exit 1; }

echo "== 6. Restauração do Storage"
npm run -s backup:storage -- importar "$(caminho "$BK/storage")"

echo "== 7. Comparação"
psqlc < "$RAIZ/scripts/sql/impressao.sql" > "$BK/depois.txt"
if diff <(grep -v "^storage.buckets" "$BK/antes.txt") <(grep -v "^storage.buckets" "$BK/depois.txt") > "$BK/diferencas.txt" && [ "$(grep "^storage.buckets" "$BK/antes.txt")" = "$(grep "^storage.buckets" "$BK/depois.txt")" ]; then
  echo "IGUAL: $(wc -l < "$BK/antes.txt") tabelas com mesma contagem e mesmo conteúdo (md5), inclusive objetos e configuração dos buckets"
else
  echo "DIFERENTE:"; cat "$BK/diferencas.txt"; exit 1
fi
grep -E "^public\.(municipios|vouchers|atividades|evidencias|evidencias_historico|auditoria) |^auth\.users |^storage\.objects " "$BK/depois.txt" | awk '{print "  " $1 ": " $2 " linhas"}'
echo "Pasta do ensaio: $BK"
