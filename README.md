# Turismo.TO

Portal de turismo para sete municípios do Tocantins: uma aplicação Next.js (Vercel) com Supabase (Postgres, Auth e Storage) e dados separados por município.

- Requisitos: [docs/SPEC.md](docs/SPEC.md)
- Plano, decisões e bloqueios: [docs/PLANO.md](docs/PLANO.md)

> Este README cobre a Fase 0. A versão completa (Supabase remoto, domínio, Vercel) entra na Fase 5.

## Pré-requisitos

- Node.js 24 LTS e npm
- Docker Desktop em execução (Supabase local e testes)

## Instalação local

```bash
npm install
npx supabase start            # sobe Postgres, Auth, Storage e Mailpit no Docker
npx supabase status           # mostra a URL e as chaves locais
cp .env.example .env.local    # preencha com os valores do status
npx supabase db reset         # aplica migrations, seed.sql e seed.dev.sql
npm run dev
```

Em `.env.local`, use `Publishable key` em `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `Secret key` em `SUPABASE_SECRET_KEY`. A chave secreta nunca vai para variáveis `NEXT_PUBLIC_*`.

## Acessar cada município

| Ambiente | Hub | Município |
|:-|:-|:-|
| Local | http://localhost:3000 | http://palmeiropolis.localhost:3000 |
| Preview da Vercel | URL do preview | URL do preview com `?municipio=palmeiropolis` |
| Produção | https://turismo.to | https://palmeiropolis.turismo.to |

Subdomínios `*.localhost` funcionam sem configurar DNS. O parâmetro `?municipio=` grava um cookie de seleção e só vale quando `ALLOW_TENANT_OVERRIDE=true` (Development e Preview). Em produção a variável não existe e o parâmetro é ignorado. `?municipio=` vazio limpa a seleção.

O painel de cada município fica em `/admin` no endereço do município.

## Usuários de desenvolvimento

`supabase/seed.dev.sql` cria, só no banco local, quatro contas `[DEV]` sem senha:

- `admin@exemplo.test`: administrador da assessoria
- `gestor.palmeiropolis@exemplo.test` e `operador.palmeiropolis@exemplo.test`
- `gestor.peixe@exemplo.test`

Para entrar com uma delas, use "Esqueci minha senha" em `/admin/login` e abra o e-mail no Mailpit (http://127.0.0.1:54324). Os testes E2E definem uma senha aleatória a cada execução.

## Criar o primeiro administrador

```bash
npm run criar-admin -- pessoa@exemplo.gov.br
```

O script convida a pessoa pelo Auth Admin API. Ela recebe um e-mail, abre o link e define a própria senha. Em seguida, o script marca o perfil como administrador da assessoria (`perfis.admin_assessoria`). Se a conta já existir, o script só faz a promoção, sem enviar convite.

Ele lê `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `NEXT_PUBLIC_ROOT_DOMAIN` de `.env.local`. Para o ambiente remoto, rode com as variáveis do projeto remoto numa máquina confiável, nunca no navegador nem em CI público. Não existe cadastro público: as demais contas são criadas por convite.

Os e-mails de convite e de recuperação usam os templates de `supabase/templates/`, que apontam para `/auth/confirm`. No projeto remoto, copie esses templates em Authentication → Email Templates.

## Verificação

```bash
npm run verify   # typecheck, lint, test, test:db, test:e2e e build
```
