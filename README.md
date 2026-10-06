# Turismo.TO

Portal de turismo para sete municípios do Tocantins: uma aplicação Next.js (Vercel) com Supabase (Postgres, Auth e Storage) e dados separados por município. Cada município tem o seu portal em `<slug>.turismo.to` e o seu painel em `<slug>.turismo.to/admin`.

| Documento | Para quê |
|:-|:-|
| [docs/SPEC.md](docs/SPEC.md) | Requisitos (manda em caso de dúvida) |
| [docs/PLANO.md](docs/PLANO.md) | Plano por fases, decisões, bloqueios e registro do que foi verificado |
| [docs/MANUAL.md](docs/MANUAL.md) | Manual para gestores e operadores |
| [docs/PRIVACIDADE.md](docs/PRIVACIDADE.md) | Dados pessoais, retenção, acesso, pedidos do titular e aviso padrão |
| [docs/BACKUP.md](docs/BACKUP.md) | Backup e restauração (banco e arquivos) |
| [docs/CUSTOS.md](docs/CUSTOS.md) | Planos e custos mensais |

## 1. Ambiente local

### Pré-requisitos

- Git.
- Node.js 24 LTS com npm 11.
- Docker Desktop **em execução**, com o comando `docker` no PATH (no Windows, reabra o terminal depois de instalar).
- Porta 3000 livre e as portas 54321 a 54327 livres (Supabase local).

### Instalação

```bash
git clone https://github.com/NeroSued/turismo.to.git
cd turismo.to
npm ci                                   # versões exatas do package-lock.json
npx playwright install chromium          # navegador dos testes de ponta a ponta
npx supabase start                       # sobe Postgres, Auth, Storage e Mailpit no Docker (a 1ª vez baixa as imagens)
npm run env:local                        # cria .env.local com a URL e as chaves do Supabase local
npx supabase db reset                    # aplica migrations, seed.sql (7 municípios) e seed.dev.sql (contas [DEV])
npm run dev
```

`npm run env:local` lê `npx supabase status`, preenche `.env.local` a partir do `.env.example` e não mostra nenhuma chave. Ele se recusa a gravar valores que não sejam do Supabase local. O `.env.local` nunca vai para o Git (`.gitignore`).

### Endereços

| Ambiente | Hub | Município | Painel |
|:-|:-|:-|:-|
| Local | http://localhost:3000 | http://palmeiropolis.localhost:3000 | http://palmeiropolis.localhost:3000/admin |
| Preview da Vercel | URL do preview | URL do preview + `?municipio=palmeiropolis` | idem + `/admin` |
| Produção | https://turismo.to | https://palmeiropolis.turismo.to | https://palmeiropolis.turismo.to/admin |

Subdomínios `*.localhost` funcionam sem configurar DNS. O parâmetro `?municipio=` grava um cookie de seleção e só vale quando `ALLOW_TENANT_OVERRIDE=true` (Development e Preview); em produção a variável não existe e o parâmetro é ignorado. `?municipio=` vazio limpa a seleção. Slug inexistente ou município desativado responde 404.

E-mails locais (convites e recuperação de senha) chegam no Mailpit: http://127.0.0.1:54324.

### Contas de desenvolvimento

`supabase/seed.dev.sql` cria, **só no banco local**, quatro contas `[DEV]` sem senha:

- `admin@exemplo.test`: administrador da assessoria
- `gestor.palmeiropolis@exemplo.test` e `operador.palmeiropolis@exemplo.test`
- `gestor.peixe@exemplo.test`

Para entrar com uma delas, use "Esqueci minha senha" em `/admin/login` e abra o e-mail no Mailpit. Os testes E2E definem uma senha aleatória a cada execução.

### Verificação

```bash
npm run verify   # typecheck, lint, Vitest, pgTAP, Playwright (390x844, build de produção) e build
```

Precisa do Supabase local rodando. Leva alguns minutos: o Playwright faz um build de produção e percorre o portal e o painel no tamanho de um celular, inclusive com o axe (acessibilidade) em todas as páginas.

Outros comandos:

```bash
npm run test:db          # só pgTAP (RLS, funções, Storage)
npm run test:e2e         # só Playwright
npm run test:e2e:preview # Playwright contra um preview da Vercel (seção 4, "E2E contra o preview")
npx supabase db reset    # zera o banco local
npx supabase migration new <nome>
npx supabase gen types typescript --local > src/lib/database.types.ts   # depois de mudar o schema
```

## 2. Variáveis de ambiente

| Variável | Onde | Valor |
|:-|:-|:-|
| `NEXT_PUBLIC_ROOT_DOMAIN` | Todos | `localhost:3000` local; `turismo.to` em produção; domínio do preview no Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | Todos | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Todos | Chave publicável (`sb_publishable_...`). Pública por natureza |
| `SUPABASE_SECRET_KEY` | Todos, **só servidor** | Chave secreta (`sb_secret_...`). Nunca em variável `NEXT_PUBLIC_*`, nunca no navegador, nunca em log |
| `ALLOW_TENANT_OVERRIDE` | Development e **Preview** | `true`. **Não crie em Production** |
| `CRON_SECRET` | Production, **só servidor** | Segredo aleatório (32 bytes ou mais) que o Vercel Cron envia à rota `/api/cron/manter-ativo`. Tipo Sensitive |

A chave secreta só é usada por `src/lib/supabase/privilegiado.ts`, nas operações listadas em "Operações privilegiadas" (D8) do [PLANO](docs/PLANO.md). Um teste falha se outro arquivo importar esse módulo.

## 3. Supabase remoto

Dois projetos, ambos no plano gratuito por decisão do Nero (2026-10-06):

| Projeto | Ref | Usado por | Dados |
|:-|:-|:-|:-|
| "Turismo.TO" (produção) | `kytbiyiltfpyvwuumfds` | Production da Vercel (`turismo.to`) | Migrations e **só** `seed.sql`. Nunca dados fictícios |
| "Turismo.TO Teste" | `lcpkzcjkijgtomoepcbe` | Preview da Vercel e E2E contra o preview | Migrations, `seed.sql` e `seed.dev.sql` (contas e dados `[DEV]`, `[E2E]`) |

No plano gratuito o Supabase **não faz backup** e **pausa o projeto depois de 7 dias sem uso**. Por isso há o cron diário da seção 4 e o backup manual de [docs/BACKUP.md](docs/BACKUP.md). Antes de ter visitantes de verdade, considere o Pro (ver [CUSTOS](docs/CUSTOS.md)).

Os bancos remotos só aceitam IPv6 na conexão direta (`db.<ref>.supabase.co`). Em máquinas ou contêineres sem IPv6 (o Docker no Windows, por exemplo), use o pooler em modo Session, que tem IPv4: host `aws-0-<região>.pooler.supabase.com`, porta `5432`, usuário `postgres.<ref>`, banco `postgres` e a senha do banco (copie a connection string pronta em Project Settings → Database → Connection string → Session pooler). Produção fica em `sa-east-1`; o projeto de teste, em `us-west-2`.

### Banco

```bash
npx supabase link --project-ref kytbiyiltfpyvwuumfds   # pede a senha do banco; não a escreva em arquivo
npx supabase db push                                    # aplica as migrations de supabase/migrations
```

Faça o mesmo no projeto de teste (`--project-ref lcpkzcjkijgtomoepcbe`). Nele podem entrar o `seed.sql` e o `seed.dev.sql`.

No de produção, aplique **só** o `seed.sql` (os sete municípios), pelo SQL Editor do painel ou pelo `psql` com a connection string do projeto. **Nunca** rode `db push --include-seed`: ele aplicaria também o `seed.dev.sql`, com contas fictícias. Nunca altere o banco remoto à mão; toda mudança é uma migration.

Confira em Advisors → Security que não há tabela sem RLS nem função exposta.

### Auth

Em Authentication → URL Configuration:

- **Site URL:** `https://turismo.to`
- **Redirect URLs:** `https://turismo.to/**` e `https://*.turismo.to/**`.

No projeto de teste: Site URL `https://teste.turismo.to` e Redirect URLs `https://teste.turismo.to/**`, `https://*.teste.turismo.to/**` e `https://*-nero-sued-s-projects.vercel.app/**` (os endereços automáticos dos previews).

Em Authentication → Email Templates, copie o assunto e o HTML de `supabase/templates/convite.html` (Invite user) e `supabase/templates/recuperacao.html` (Reset password). Eles usam `token_hash` e a rota `/auth/confirm`.

Cadastro público fica desligado: Authentication → Sign In / Providers → desmarque "Allow new users to sign up". As contas entram só por convite.

### E-mail transacional (Resend)

Decisão do Nero: Resend, com o subdomínio de envio `envio.turismo.to`, ligado ao Supabase Auth como SMTP personalizado. O SMTP padrão do Supabase só envia para a equipe do projeto, 2 mensagens por hora, e não serve para produção. O domínio `turismo.to` usa os nameservers da Vercel, então **os registros DNS do Resend são criados no DNS da Vercel**.

1. **Resend → Domains → Add Domain:** `envio.turismo.to`. Região: a mais próxima do Brasil entre as oferecidas.
2. O Resend mostra os registros a criar (normalmente um TXT de DKIM em `resend._domainkey.envio`, e um MX e um TXT de SPF em `send.envio`). **Copie exatamente os nomes e valores que a tela do Resend mostrar.**
3. **Vercel → Domains → turismo.to → DNS Records → Add**, um por um, com o tipo, o nome e o valor copiados. No campo de nome da Vercel, use a parte antes de `.turismo.to` (ex.: `resend._domainkey.envio`).
4. Opcional e recomendado: um TXT `_dmarc.envio` com `v=DMARC1; p=none;` para começar a receber relatórios.
5. Volte ao Resend e toque em **Verify DNS Records**. A verificação pode levar de minutos a algumas horas.
6. **Resend → API Keys → Create API Key**, permissão **Sending access**, restrita ao domínio `envio.turismo.to`. Copie a chave uma única vez, direto para o passo seguinte; não a salve em arquivo do projeto nem cole em conversa.
7. **Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP:**
   - Sender email: `nao-responda@envio.turismo.to`
   - Sender name: `Turismo.TO`
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: a chave do passo 6
8. Em Authentication → Rate Limits, confira o limite de e-mails por hora e ajuste ao volume esperado (o dia em que todas as equipes forem convidadas é o pico).
9. Teste: convide uma conta sua pelo painel (Equipe → Convidar pessoa) e confira que o e-mail chega e que o link abre `https://<município>.turismo.to/conta/nova-senha`.

Fontes: https://resend.com/docs/send-with-supabase-smtp e https://supabase.com/docs/guides/auth/auth-smtp (consultadas em 2026-10-05).

## 4. Vercel e domínio

### Projeto

1. **Vercel → Add New → Project →** importe `NeroSued/turismo.to`. Framework: Next.js (detectado). Plano Pro (o Hobby é só para uso não comercial).
2. **Settings → Environment Variables:** as variáveis da seção 2, separadas por ambiente. Production aponta para o projeto "Turismo.TO"; Preview, para o "Turismo.TO Teste", com `NEXT_PUBLIC_ROOT_DOMAIN=teste.turismo.to`. `ALLOW_TENANT_OVERRIDE=true` só em Preview (e Development). `SUPABASE_SECRET_KEY` e `CRON_SECRET` marcadas como "Sensitive".
3. Cada push numa branch gera um preview; merge em `main` publica em produção.

### Domínio `turismo.to` e curinga

O domínio está registrado no Spaceship e os nameservers já apontam para a Vercel (`ns1.vercel-dns.com` e `ns2.vercel-dns.com`, conferido em 2026-10-05). O curinga `*.turismo.to` precisa disso: a Vercel emite o certificado do curinga pelo próprio DNS.

1. **Project → Settings → Domains → Add:** `turismo.to`. Aceite também `www.turismo.to` redirecionando para `turismo.to`.
2. **Add:** `*.turismo.to`. A Vercel emite o certificado do curinga automaticamente.
3. Confira: `https://turismo.to` abre o hub; `https://palmeiropolis.turismo.to` abre o portal; `https://naoexiste.turismo.to` responde 404.
4. Qualquer registro DNS novo (Resend, verificação do Google etc.) é criado em **Vercel → Domains → turismo.to → DNS Records**, não no Spaceship.
5. No Spaceship, ative a renovação automática do domínio.

### Cron diário (manter o Supabase gratuito ativo)

O `vercel.json` agenda uma chamada por dia, às 09:00 UTC (06:00 em Araguaína), a `GET /api/cron/manter-ativo`. A rota:

- só responde se o cabeçalho `Authorization` for `Bearer <CRON_SECRET>` (a Vercel envia isso sozinha quando a variável existe); sem ele, ou com outro valor, responde `401`;
- faz uma leitura leve e pública no banco (um município), com a chave publicável, sem sessão e sem chave secreta;
- responde só `{"ok":true}` (ou `503` se o banco não respondeu), sempre com `Cache-Control: private, no-store`.

Os crons da Vercel rodam só em Production. Para conferir: **Vercel → Project → Settings → Cron Jobs** (mostra a próxima execução e o histórico) ou, à mão, com o segredo:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://turismo.to/api/cron/manter-ativo   # 200 {"ok":true}
curl -i https://turismo.to/api/cron/manter-ativo                                          # 401
```

Se o projeto chegar a pausar mesmo assim, o painel do Supabase mostra "Restore project"; restaurar não perde dados.

### E2E contra o preview

O mesmo E2E do ambiente local roda contra um deploy de preview, ligado ao projeto "Turismo.TO Teste". Como o portal escolhe o município pelo subdomínio, o deploy recebe aliases da Vercel: `teste.turismo.to` (hub) e `<slug>.teste.turismo.to` para os sete municípios e para `naoexiste` (o teste do 404):

```bash
npx vercel alias set <url-do-deploy> palmeiropolis.teste.turismo.to   # e assim por diante
```

Crie um `.env.e2e-preview` (fora do git) com `E2E_ALVO=preview`, `E2E_RAIZ=teste.turismo.to`, `E2E_VERCEL_BYPASS` (Settings → Deployment Protection → Protection Bypass for Automation), `E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`, `E2E_SUPABASE_SECRET_KEY` e `E2E_DB_URL` (pooler do projeto de teste) e rode `npm run test:e2e:preview`. O `tests/ambiente.ts` recusa qualquer projeto que não seja o de teste, e o de produção pelo nome. No preview, os e-mails de convite vão para `delivered+<rótulo>@resend.dev` (endereço de simulação do Resend) e o link é montado pelo banco de teste.

## 5. Primeiro administrador

```bash
npm run criar-admin -- pessoa@exemplo.gov.br
```

O script convida a pessoa pelo Auth Admin API. Ela recebe um e-mail, abre o link e define a própria senha; ninguém mais conhece essa senha. Em seguida, o script marca o perfil como administrador da assessoria. Se a conta já existir, só faz a promoção, sem convite.

Ele lê `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `NEXT_PUBLIC_ROOT_DOMAIN` de `.env.local`. Para o ambiente remoto, rode numa máquina confiável com um `.env.local` temporário com os valores do projeto remoto (e `NEXT_PUBLIC_ROOT_DOMAIN=turismo.to`) e apague-o em seguida. Nunca rode em CI público.

Os demais administradores são concedidos pela área **Assessoria** do painel; gestores e operadores, pela tela **Equipe** de cada município.

## 6. Operação

- **Backup:** semanal, banco e arquivos, conforme [docs/BACKUP.md](docs/BACKUP.md). O backup diário do Supabase não inclui os arquivos.
- **Anonimização:** nome e contato de visitantes são apagados automaticamente pelo próprio banco, todo dia, depois do prazo de cada município (padrão 90 dias).
- **Expiração de vouchers:** rotina do banco a cada 10 minutos.
- **Custos:** [docs/CUSTOS.md](docs/CUSTOS.md).
