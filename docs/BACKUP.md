# Backup e restauração

O sistema guarda dados em dois lugares, e cada um precisa da sua cópia:

1. **Banco de dados** (municípios, cadastros, vouchers, evidências, contas, auditoria).
2. **Arquivos** no Storage: bucket `publico` (fotos do portal, logos, capas) e bucket `interno` (comprovantes de adesão, listas de presença, atas, fotos de evidência).

O backup automático do Supabase cobre só o banco. Segundo a documentação oficial, "Database backups do not include objects you store via the Storage API" (https://supabase.com/docs/guides/platform/backups, consultada em 2026-10-05). Os arquivos precisam da exportação descrita abaixo.

## O que o Supabase faz sozinho, por plano

| Plano | Cópia automática do banco | Observação |
|:-|:-|:-|
| Free | Nenhuma | Projeto pausa depois de 1 semana sem uso. Não usar em produção. |
| Pro | Diária, guardada por 7 dias | Restauração pelo painel: Database → Backups |
| Pro + PITR | Contínua, volta a qualquer segundo dos últimos 7 dias | US$ 100/mês (ver [CUSTOS.md](CUSTOS.md)) |

O plano previsto é o Pro. A cópia diária dele protege contra erro no banco descoberto em até 7 dias. Ela não protege contra perda da conta, contra um erro descoberto depois de 7 dias, nem contra a perda de arquivos do Storage. Por isso a exportação própria abaixo é obrigatória.

## Exportação periódica (feita pela assessoria)

**Frequência:** semanal, e sempre antes de qualquer mudança grande (migração, troca de plano, exclusão em massa). Guarde as 4 últimas semanais e 1 por mês do último ano.

**Onde guardar:** fora do Supabase e fora da Vercel, num disco ou serviço da assessoria, **cifrado**. A cópia tem dados pessoais (nome e contato de visitantes ainda não anonimizados, e-mails da equipe) e documentos internos. Quem tem a cópia tem esses dados: trate como o próprio banco.

**Máquina:** um computador confiável da assessoria com Node.js 24, Docker e o repositório. Nunca rode em computador compartilhado.

### 1. Banco

A conexão vem do painel do Supabase (Project Settings → Database → Connection string, modo "Session"). A senha do banco é pedida pelo terminal; não a escreva em arquivo nem em comando que fique no histórico.

```bash
PASTA=backup-$(date +%Y-%m-%d)
mkdir -p "$PASTA"
npx supabase link --project-ref kytbiyiltfpyvwuumfds   # uma vez por máquina; pede a senha do banco

npx supabase db dump --linked --role-only -f "$PASTA/roles.sql"
npx supabase db dump --linked -f "$PASTA/schema.sql"
npx supabase db dump --linked --data-only --use-copy \
  -x storage.buckets -x storage.buckets_analytics -x storage.buckets_vectors \
  -x storage.iceberg_namespaces -x storage.iceberg_tables -x storage.vector_indexes \
  -x storage.s3_multipart_uploads -x storage.s3_multipart_uploads_parts \
  -x supabase_functions.hooks \
  -f "$PASTA/data.sql"
```

Os `-x` deixam de fora tabelas que as migrations criam (os dois buckets) e tabelas internas do Storage que o usuário `postgres` não pode gravar. Sem eles, a restauração falha (aprendido no ensaio de 2026-10-05).

### 2. Arquivos do Storage

Com as variáveis do projeto remoto num arquivo `.env.local` **só desta máquina** (`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY`; o resto como no `.env.example`):

```bash
npm run backup:storage -- exportar "$PASTA/storage"
```

O script baixa todos os arquivos dos buckets `publico` e `interno` e grava `manifesto.json` com o caminho, o tipo, o tamanho e o SHA-256 de cada um. Ele usa a chave secreta: é a operação privilegiada D8.5 do [PLANO](PLANO.md). Ao terminar, volte o `.env.local` para os valores locais ou apague-o.

### 3. Conferir e cifrar

Confira que `data.sql` não está vazio e que o número de arquivos exportados bate com o painel (Storage). Depois compacte e cifre a pasta inteira (por exemplo, 7-Zip com AES-256 e senha guardada no gerenciador de senhas da assessoria) e apague a pasta aberta.

## Restauração

### Caso 1: erro recente no banco (até 7 dias)

Painel do Supabase → Database → Backups → escolha o dia → Restore. O projeto fica fora do ar durante a restauração. Os arquivos do Storage não mudam. Depois, rode `npm run backup:storage -- importar <pasta>` com a cópia mais recente para repor arquivos que tenham sido apagados.

### Caso 2: projeto perdido ou erro antigo (a partir da cópia própria)

1. Crie um projeto novo no Supabase (plano Pro) e ligue o repositório a ele:
   ```bash
   npx supabase link --project-ref <ref-do-projeto-novo>
   npx supabase db push            # cria tabelas, funções, políticas, buckets e rotinas pelas migrations
   ```
   Não rode o `seed.sql`: os municípios vêm da cópia.
2. Carregue os dados numa única transação, sem disparar triggers (a auditoria e o histórico vêm da cópia, iguais ao original):
   ```bash
   { echo "set session_replication_role = replica;"; cat "$PASTA/data.sql"; } \
     | psql "<connection string do projeto novo>" -v ON_ERROR_STOP=1 --single-transaction
   ```
   Se algo falhar, nada fica gravado pela metade; corrija e rode de novo.
3. Arquivos, com o `.env.local` apontando para o projeto novo:
   ```bash
   npm run backup:storage -- importar "$PASTA/storage"
   ```
   O script confere o SHA-256 de cada arquivo da cópia, envia os que faltam ou diferem e confere de novo depois do envio.
4. Refaça no projeto novo a configuração que não está no banco: Auth (Site URL, URLs de redirecionamento, SMTP do Resend e templates de `supabase/templates/`), e troque na Vercel as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`. Ver [README](../README.md).
5. As senhas das contas voltam junto com `auth.users` (só o hash). Peça à equipe para entrar normalmente; quem não conseguir usa "Esqueci minha senha".

`roles.sql` e `schema.sql` servem para conferência e para restaurar fora do Supabase. No Supabase, a estrutura vem das migrations versionadas, que são a fonte da verdade.

## Ensaio de restauração

O procedimento acima foi executado no ambiente local em **2026-10-05**, com o script `scripts/ensaio-restauracao.sh` (só funciona contra o Supabase local; recusa `.env.local` que aponte para outro lugar):

1. fotografa 22 tabelas (quantidade de linhas e md5 do conteúdo; dos objetos do Storage, bucket e caminho);
2. faz o dump (papéis, estrutura e dados, com os `-x` acima) e exporta o Storage;
3. simula o desastre: apaga 2 arquivos pela API do Storage (um de cada bucket) e zera o banco só com as migrations (`supabase db reset --no-seed`, equivalente a projeto novo + `db push`);
4. carrega `data.sql` (transação única, sem triggers) e reimporta os arquivos;
5. fotografa de novo e compara.

Resultado: "IGUAL: 22 tabelas com mesma contagem e mesmo conteúdo (md5), inclusive objetos e configuração dos buckets"; "Restauração conferida: 2 arquivos no manifesto, 2 enviados de volta". As sequências de `auditoria` e `evidencias_historico` continuaram à frente do maior id restaurado.

Repita o ensaio local depois de mudanças no schema:

```bash
npx supabase start
bash scripts/ensaio-restauracao.sh      # apaga e recria o banco LOCAL
```

E, uma vez por semestre, restaure a cópia real num projeto Supabase de teste (caso 2), confira as contagens e apague o projeto de teste.
