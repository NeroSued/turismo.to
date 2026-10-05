# Plano de execução: Turismo.TO

Como usar este arquivo:

- Cada fase tem itens, critérios de aceite ("Pronto quando") e o comando `/goal` pronto para colar.
- Marque `[x]` só depois de verificar. Registre cada item concluído em "Registro".
- Entre uma fase e outra, rode `/clear` no Claude Code e cole o `/goal` da fase seguinte. O estado fica neste arquivo, não na conversa.

## Estado

- Fase ativa: **1**
- Última atualização: 2026-10-05

---

## Decisões técnicas já tomadas

Valem para todas as fases. Mudanças entram em "Decisões" no fim do arquivo, com motivo.

**D1. Município pelo host.** Ver CLAUDE.md, seção "Identificação do município".

**D2. Papéis.** `perfis.admin_assessoria` (booleano, só alterável por outro admin) e `vinculos (user_id, municipio_id, papel)` com papel `gestor` ou `operador`. Funções SQL de apoio: `eh_admin()`, `tem_papel(municipio_id, papeis text[])`. O admin da assessoria passa em todas as checagens de município.

**D3. Atividades e modos.** O voucher pertence a uma atividade. Atividade tem modo `registro_voluntario` (atrativo de acesso livre, sem limite, avisa que o cadastro não condiciona a entrada) ou `reserva` (sessões com data, horário e capacidade opcional em pessoas). Cadastrar um atrativo nunca cria atividade automaticamente.

**D4. Vagas por pessoas.** `sessoes.capacidade_pessoas` (nulo = sem limite) e `sessoes.pessoas_reservadas`. A emissão reserva vagas com um único `UPDATE ... SET pessoas_reservadas = pessoas_reservadas + n WHERE id = $1 AND (capacidade_pessoas IS NULL OR pessoas_reservadas + n <= capacidade_pessoas) RETURNING`, na mesma transação que insere o voucher. O cancelamento devolve as vagas na mesma transação que muda o estado, com guarda `WHERE status = 'emitido'`.

**D5. Idempotência.** O formulário público envia uma `chave_idempotencia` (UUID gerado no cliente). Índice único `(municipio_id, chave_idempotencia)`. Repetição devolve o mesmo voucher.

**D6. Código e token.** Código do voucher com 12 caracteres do alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sem 0, O, 1, I, L), gerado no banco com bytes aleatórios e exibido como `XXXX-XXXX-XXXX`. O QR Code contém apenas o código. O link do visitante leva um token aleatório de 32 bytes; o banco guarda só o hash SHA-256. Token inválido e voucher inexistente recebem a mesma resposta.

**D7. Estados do voucher.**

| De | Para | Quem | Regra |
|:-|:-|:-|:-|
| (novo) | emitido | visitante ou operador (assistida) | atividade publicada, sessão futura com vagas |
| emitido | utilizado | operador ou gestor do município do voucher | só no dia da sessão (fuso America/Araguaina); `pessoas_atendidas` entre 1 e `pessoas`; grava horário e operador |
| emitido | cancelado | visitante com token, gestor ou operador | devolve as vagas |
| emitido | expirado | rotina automática | fim da sessão mais 2 horas (registro voluntário: fim do dia) |
| utilizado, cancelado, expirado | (nenhum) | | estados finais |

Confirmar de novo um voucher utilizado devolve "já utilizado" com horário e operador da confirmação, sem alterar nada. Voucher de outro município devolve "outro município" sem revelar detalhes.

**D8. Operações privilegiadas permitidas** (únicas que usam `service_role`, sempre no servidor):

1. Emissão pública de voucher.
2. Consulta e cancelamento pelo token do visitante.
3. Script `criar-admin`.

A expiração roda no próprio banco com `pg_cron`. Confirmação, emissão assistida e todo o painel usam a sessão do usuário com RLS.

**D9. Limite de requisições.** Tabela `limites_requisicao` (hash do IP + município + janela). Emissão pública: até 10 por IP por município a cada 10 minutos. Consulta por token: até 30 por IP a cada 10 minutos.

**D10. Dados do visitante.** Obrigatórios: cidade, UF e quantidade de pessoas. Nome do responsável e contato só quando a atividade exigir (`exige_responsavel`, `exige_contato`). Nada de CPF, documento ou endereço. Nome e contato são anonimizados 90 dias após a sessão (prazo configurável), mantendo cidade, UF e contagens.

**D11. Testes contra banco real.** Testes de integração e pgTAP rodam no Supabase local (Docker). Nunca rode testes destrutivos no projeto remoto.

---

## Fase 0: Fundação

- [x] 0.1 Inspecionar o repositório, preservar o que existir e registrar o que foi encontrado.
- [x] 0.2 Verificar ferramentas: Node LTS, npm, git com remoto configurado, Docker em execução, Supabase CLI via `npx`. Docker ausente é bloqueio.
- [x] 0.3 Criar a aplicação Next.js (App Router, TypeScript strict, Tailwind, ESLint) com versões estáveis atuais e `package-lock.json`.
- [x] 0.4 Instalar shadcn/ui, lucide-react, Zod e as fontes; aplicar as cores do CLAUDE.md; criar o layout base para celular.
- [x] 0.5 Inicializar o Supabase local e criar os clientes: navegador, servidor (cookies) e privilegiado (`server-only`).
- [x] 0.6 Migrations: `municipios`, `configuracoes_municipio`, `perfis`, `vinculos`, `auditoria` com trigger genérico, funções `eh_admin` e `tem_papel`, políticas RLS.
- [x] 0.7 `seed.sql` com os sete municípios (nome e slug da SPEC). `seed.dev.sql` com usuários `[DEV]`: admin da assessoria, gestor e operador de Palmeirópolis, gestor de Peixe.
- [x] 0.8 Resolução de município por host, override restrito a dev e preview, hub com os municípios ativos, 404 para slug inválido.
- [x] 0.9 Autenticação: login por e-mail e senha em `/admin/login`, recuperação de senha, logout, nenhum cadastro público; `/admin` exige vínculo com o município do host.
- [x] 0.10 Script `npm run criar-admin -- <email>`: convida pelo Auth Admin API e marca o perfil como admin. Documentar no README.
- [x] 0.11 Infra de testes: Vitest, pgTAP, Playwright (390x844), script `verify` e teste que falha se `privilegiado.ts` for importado fora dos arquivos permitidos.
- [x] 0.12 `.gitignore` cobrindo `.env*` (exceto `.env.example`) e `.env.example` sem segredos.

**Pronto quando:**

- `npm run verify` termina com código 0.
- pgTAP prova que: usuário sem vínculo não lê vínculos nem perfis de outros; nenhum usuário altera o próprio perfil ou vínculo; visitante anônimo lê apenas dados públicos de municípios ativos.
- E2E: o hub lista os sete municípios; `palmeiropolis.localhost:3000` abre o portal; `/admin` sem login redireciona para o login; o gestor de Peixe logado em Palmeirópolis recebe "sem acesso".
- Teste prova que `?municipio=` é ignorado quando `ALLOW_TENANT_OVERRIDE` não está definida.
- `git grep` não encontra chaves nem senhas em arquivos versionados.

```
/goal Fase 0 de docs/PLANO.md concluída: itens 0.1 a 0.12 marcados [x] com linha no Registro, npm run verify termina com código 0 e a saída final aparece na conversa, e você colou a lista "Pronto quando" da Fase 0 com o resultado de cada critério. Siga o CLAUDE.md. Se faltar Docker, credencial ou decisão do Nero, registre em Bloqueios, escreva BLOQUEADO com o motivo e pare. Pare após 60 turnos.
```

---

## Fase 1: Voucher de ponta a ponta

Primeira entrega completa: criar atividade, publicar, emitir voucher, confirmar participação e gerar relatório.

- [x] 1.1 Migrations: `atividades` (modo, status rascunho/publicado/arquivado, condições, `exige_responsavel`, `exige_contato`, atrativo opcional por FK composta), `sessoes`, `vouchers`, `limites_requisicao`.
- [x] 1.2 Funções no banco: emissão (D4, D5, D6), confirmação, cancelamento pelo painel, consulta e cancelamento por token, expiração com `pg_cron`.
- [x] 1.3 Painel do gestor: criar, editar, publicar e arquivar atividades; gerenciar sessões e capacidade.
- [x] 1.4 Portal público: lista de atividades publicadas e fluxo de reserva conforme a tela "Reserva gratuita" do canvas.
- [x] 1.5 Comprovante conforme a tela "Voucher emitido": código, QR, município, atividade, horário, pessoas, gratuidade; salvar e imprimir (CSS de impressão); link com token para consultar e cancelar.
- [x] 1.6 Atendimento conforme a tela "Operador": leitura do QR pela câmera (biblioteca leve e mantida), digitação do código, conferência, quantidade atendida, telas de já utilizado, cancelado, expirado e outro município.
- [x] 1.7 Emissão assistida pelo operador para visitante sem celular, com comprovante para imprimir ou mostrar.
- [ ] 1.8 Relatório básico do período: vouchers emitidos, utilizados, cancelados e expirados; pessoas reservadas; participações confirmadas; registros voluntários. Cada número com rótulo que não confunda reserva com visita.
- [ ] 1.9 Auditoria de emissão assistida, confirmação, cancelamento e alterações de atividade.

**Pronto quando:**

- Teste de concorrência: 30 emissões simultâneas, de 1 a 3 pessoas cada, para uma sessão de 15 vagas. A soma de pessoas dos vouchers emitidos fica em no máximo 15 e é igual a `pessoas_reservadas`.
- A mesma chave de idempotência enviada várias vezes gera um único voucher.
- Confirmação repetida não altera contagens; voucher cancelado e expirado são rejeitados; voucher de Palmeirópolis é rejeitado por operador de Peixe.
- Visitante anônimo não lê `vouchers` por consulta direta; operador vê apenas os campos necessários para conferir.
- Cancelamento devolve exatamente as pessoas do voucher; token errado recebe a mesma resposta de voucher inexistente.
- O QR Code contém apenas o código (teste).
- Teste de coerência: pessoas reservadas, pessoas atendidas e números do relatório batem com os vouchers criados no teste.
- E2E no celular: gestor cria e publica atividade com sessão; visitante reserva; operador confirma; relatório mostra o voucher como utilizado com a quantidade atendida.
- `npm run verify` termina com código 0.

```
/goal Fase 1 de docs/PLANO.md concluída: itens 1.1 a 1.9 marcados [x] com linha no Registro, os testes de concorrência, idempotência, confirmação repetida, voucher cancelado, voucher de outro município e coerência do relatório passam e aparecem na conversa, o E2E de ponta a ponta no celular passa, npm run verify termina com código 0 e você colou a lista "Pronto quando" da Fase 1 com o resultado de cada critério. Siga o CLAUDE.md e as telas do canvas. Se faltar credencial ou decisão do Nero, registre em Bloqueios, escreva BLOQUEADO com o motivo e pare. Pare após 80 turnos.
```

---

## Fase 2: Portal público e cadastros

- [ ] 2.1 Migrations: `atrativos`, `eventos` (atrativo opcional), `prestadores`, `adesoes_prestador` (data, responsável, comprovante privado), `fotos` com legenda. Estados rascunho, publicado e arquivado.
- [ ] 2.2 Buckets `publico` e `interno` com políticas por pasta `<municipio_id>/`; limites: fotos JPEG, PNG ou WebP até 5 MB; documentos PDF, JPEG ou PNG até 10 MB.
- [ ] 2.3 Painel: cadastro de atrativos, eventos e prestadores com formulários curtos, upload de fotos e estados vazios úteis.
- [ ] 2.4 Configurações do município: nome de exibição, logo, cor primária (com validação de contraste), contato da Secretaria de Turismo, link da Ouvidoria oficial, texto do aviso de privacidade, referência da cartilha do ICMS Ecológico.
- [ ] 2.5 Portal público conforme a tela "Portal municipal": apresentação, atividades com voucher, eventos e calendário, atrativos, rede de prestadores, contato, Ouvidoria e aviso de privacidade.
- [ ] 2.6 Metadados por município (título, descrição, Open Graph) e imagens otimizadas.

**Pronto quando:**

- pgTAP de Storage: gestor de Peixe não grava nem lê na pasta de Palmeirópolis; anônimo não lê o bucket `interno`.
- Conteúdo em rascunho ou arquivado não aparece no portal nem em consultas anônimas (teste).
- Contatos internos e comprovantes de adesão nunca aparecem em páginas ou respostas públicas (teste).
- Upload com tipo errado ou acima do limite é rejeitado no servidor (teste).
- Playwright com axe: nenhuma violação crítica ou séria nas páginas públicas.
- `npm run verify` termina com código 0.

```
/goal Fase 2 de docs/PLANO.md concluída: itens 2.1 a 2.6 marcados [x] com linha no Registro, os testes de Storage, de visibilidade de rascunho e arquivado, de dados internos fora das respostas públicas, de upload inválido e de acessibilidade passam e aparecem na conversa, npm run verify termina com código 0 e você colou a lista "Pronto quando" da Fase 2 com o resultado de cada critério. Siga o CLAUDE.md e o canvas. Se houver bloqueio, registre, escreva BLOQUEADO com o motivo e pare. Pare após 70 turnos.
```

---

## Fase 3: Relatórios e evidências

- [ ] 3.1 Relatórios por município, período e ano-base: emitidos, utilizados, cancelados, expirados, participações confirmadas, registros voluntários, origem por cidade e UF, atividades e prestadores envolvidos.
- [ ] 3.2 Exportação CSV e versão para impressão ou PDF pelo navegador.
- [ ] 3.3 Versão para divulgação, sem nome, contato ou qualquer dado pessoal.
- [ ] 3.4 Evidências: tipo da ação, descrição, data de realização, responsável, fotos com legenda, anexos (listas de presença, atas e outros), ano-base. Data de realização separada da data de inclusão.
- [ ] 3.5 Histórico de alterações de evidências com autoria.
- [ ] 3.6 Minuta do relatório de implantação: atividades, indicadores, evidências, seções editáveis de metodologia, limitações, análise e recomendações, campos em branco para identificação e assinatura do gestor, aviso de que não substitui a análise estadual.

**Pronto quando:**

- O CSV de divulgação não contém nome nem contato (teste).
- Gestor de Peixe não obtém relatório nem evidência de Palmeirópolis por página, rota ou consulta (teste).
- Rotas de relatório respondem com `Cache-Control: private, no-store` (teste).
- Editar uma evidência gera registro no histórico com autor e horário (teste).
- A minuta não contém assinatura simulada, aprovação de conselho nem promessa de pontuação (teste de conteúdo).
- `npm run verify` termina com código 0.

```
/goal Fase 3 de docs/PLANO.md concluída: itens 3.1 a 3.6 marcados [x] com linha no Registro, os testes de CSV sem dados pessoais, isolamento entre municípios, cabeçalho no-store, histórico de evidências e conteúdo da minuta passam e aparecem na conversa, npm run verify termina com código 0 e você colou a lista "Pronto quando" da Fase 3 com o resultado de cada critério. Siga o CLAUDE.md. Se houver bloqueio, registre, escreva BLOQUEADO com o motivo e pare. Pare após 60 turnos.
```

---

## Fase 4: Administração e usuários

- [ ] 4.1 Área do admin da assessoria: lista de municípios, ativar e desativar, acesso às configurações de cada um.
- [ ] 4.2 Convite de usuário por e-mail com papel e município; alterar papel; desativar vínculo.
- [ ] 4.3 Menu do operador restrito a atendimento e emissão assistida.
- [ ] 4.4 Página de auditoria com filtros por município, usuário, período e tipo de ação.

**Pronto quando:**

- Gestor não se promove nem promove outro usuário a admin, nem cria vínculo em outro município (pgTAP e teste de rota).
- Operador não acessa conteúdo, relatórios, evidências nem configurações (E2E).
- Convite cria usuário sem senha compartilhada; o próprio convidado define a senha.
- `npm run verify` termina com código 0.

```
/goal Fase 4 de docs/PLANO.md concluída: itens 4.1 a 4.4 marcados [x] com linha no Registro, os testes de escalada de privilégio, de restrição do operador e de convite passam e aparecem na conversa, npm run verify termina com código 0 e você colou a lista "Pronto quando" da Fase 4 com o resultado de cada critério. Siga o CLAUDE.md. Se houver bloqueio, registre, escreva BLOQUEADO com o motivo e pare. Pare após 50 turnos.
```

---

## Fase 5: Privacidade, qualidade e documentação

- [ ] 5.1 Rotina de anonimização (D10) com prazo configurável por município.
- [ ] 5.2 `docs/PRIVACIDADE.md`: finalidade, dados coletados, retenção, quem acessa, procedimento de exclusão e anonimização. Texto padrão do aviso de privacidade, marcado para revisão jurídica da prefeitura.
- [ ] 5.3 Revisão de acessibilidade e desempenho no celular em todas as telas, incluindo o painel.
- [ ] 5.4 `README.md`: instalação, Supabase local e remoto, variáveis, domínio, implantação na Vercel, criação do primeiro admin.
- [ ] 5.5 `docs/MANUAL.md`: manual curto para gestores e operadores, com o passo a passo de cada tarefa comum.
- [ ] 5.6 `docs/CUSTOS.md`: planos e custos recorrentes (Vercel, Supabase, domínio, SMTP), sem presumir que plano gratuito serve ao uso comercial. Conferir preços atuais nas páginas oficiais e citar a data.
- [ ] 5.7 `docs/BACKUP.md`: backups do Supabase conforme o plano contratado, exportação periódica do banco e do Storage, procedimento de restauração testado localmente.

**Pronto quando:**

- Teste prova que a anonimização apaga nome e contato e preserva cidade, UF e contagens.
- Axe sem violações críticas ou sérias em todas as páginas, públicas e do painel.
- Seguindo apenas o README, um clone limpo instala, sobe o Supabase local e roda `npm run verify` com código 0 (execute em pasta temporária e mostre a saída).
- A restauração de backup descrita em `docs/BACKUP.md` foi executada no ambiente local.

```
/goal Fase 5 de docs/PLANO.md concluída: itens 5.1 a 5.7 marcados [x] com linha no Registro, o teste de anonimização e o axe em todas as páginas passam, o README foi validado em clone limpo com npm run verify terminando com código 0, a restauração de backup foi executada localmente, tudo com saída na conversa, e você colou a lista "Pronto quando" da Fase 5 com o resultado de cada critério. Siga o CLAUDE.md. Se houver bloqueio, registre, escreva BLOQUEADO com o motivo e pare. Pare após 50 turnos.
```

---

## Fase 6: Implantação (precisa do Nero)

- [ ] 6.1 Vincular o projeto remoto "Turismo.TO" e aplicar as migrations com `supabase db push`, só com `seed.sql` (municípios).
- [ ] 6.2 Auth remoto: Site URL, URLs de redirecionamento, SMTP próprio para convites e recuperação de senha.
- [ ] 6.3 Projeto na Vercel ligado ao GitHub, variáveis por ambiente (`ALLOW_TENANT_OVERRIDE` só em Preview).
- [ ] 6.4 Domínio `turismo.to` e curinga `*.turismo.to` (o curinga exige os nameservers da Vercel).
- [ ] 6.5 Criar o primeiro admin com o script e entregar o acesso ao Nero.
- [ ] 6.6 Teste de fumaça no preview pelo celular e E2E com `BASE_URL` apontando para o preview.

**Pronto quando:**

- O preview abre com `?municipio=palmeiropolis` e o fluxo E2E passa contra ele.
- Consulta SQL no remoto mostra zero vouchers, evidências e conteúdos `[DEV]`.
- Os advisors de segurança do Supabase não apontam tabelas sem RLS nem funções expostas.

```
/goal Fase 6 de docs/PLANO.md concluída: itens 6.1 a 6.6 marcados [x] com linha no Registro, o E2E passa contra o preview da Vercel, a consulta no banco remoto confirma ausência de dados fictícios e os advisors de segurança do Supabase estão limpos, tudo com saída na conversa. Antes de qualquer ação no projeto remoto ou na Vercel, confirme com o Nero. Se houver bloqueio, registre, escreva BLOQUEADO com o motivo e pare. Pare após 40 turnos.
```

---

## Bloqueios

Pendências externas conhecidas. Atualize quando surgirem novas ou forem resolvidas.

- [x] Docker em execução na máquina do Nero. Resolvido em 2026-10-05: Docker Desktop 4.94 (engine 29.8.2) instalado por usuário em `%LOCALAPPDATA%ProgramsDockerDesktop`. Sessões de terminal abertas antes da instalação precisam do caminho `resourcesin` no PATH (ou reabrir o terminal).
- [ ] Senha do banco remoto: hoje no `.env` local; manter fora do git e, se algum dia foi commitada, trocar no painel do Supabase. Em 2026-10-05 o valor apareceu por engano na conversa do Claude Code (filtro de redação esperava `=` e o arquivo usa `chave:valor`). Nero deve trocar a senha em Project Settings → Database.
- [ ] Acesso à Vercel (equipe e projeto).
- [ ] Compra do domínio `turismo.to`.
- [ ] Serviço de SMTP para e-mails de convite e recuperação de senha.
- [ ] Logos, fotos e textos oficiais de cada prefeitura.
- [ ] Revisão jurídica do aviso de privacidade pelas prefeituras.

## Decisões

Registre aqui decisões tomadas durante a execução: data, decisão, motivo.

- 2026-10-05: `main` recebeu um commit inicial só com `CLAUDE.md` e `docs/`, porque o repositório remoto estava vazio e a branch da fase precisa nascer de `main`. Todo o resto vai em `fase-0-fundacao`.
- 2026-10-05: item 0.12 (`.gitignore`) feito antes de 0.3, para que nenhum commit pudesse incluir o `.env` existente.
- 2026-10-05: `@types/node` em `^24` (Node 24 instalado), exigido pelo Vitest 5. `.gitattributes` fixa LF para evitar diferenças de fim de linha no Windows.
- 2026-10-05: npm 11 bloqueia scripts de instalação; aprovados em `package.json > allowScripts` apenas `esbuild`, `supabase` (baixa o binário do CLI) e `unrs-resolver`. Atualizar a versão desses pacotes exige nova aprovação.
- 2026-10-05: `eh_admin()` e `tem_papel()` ficam no schema `privado` (fora dos schemas da Data API), com `usage`/`execute` para `anon` e `authenticated`. Motivo: funções `security definer` em `public` viram endpoints RPC. O trigger que protege `admin_assessoria` é `security invoker` de propósito, porque precisa de `current_user` igual ao papel da sessão.
- 2026-10-05: tabelas novas não são mais expostas automaticamente à Data API (changelog do Supabase, 2026-04-28), então a migration faz `revoke all` e concede `GRANT`s explícitos, inclusive ao `service_role`.
- 2026-10-05: nesta fase só o admin grava `vinculos` (nunca os próprios). Gestor gerenciar a equipe do próprio município fica para a Fase 4.2.
- 2026-10-05: convite e recuperação usam templates com `token_hash` (`supabase/templates/`) e a rota global `/auth/confirm` (`verifyOtp`), porque o convite da Admin API não suporta PKCE. `/auth/*` e `/conta/*` não são reescritas pelo proxy e atendem o hub e os subdomínios. No remoto, os templates precisam ser copiados no painel (Fase 6.2).
- 2026-10-05: a árvore interna `/m/<slug>` responde 404 quando acessada diretamente; só a reescrita do proxy chega nela.
- 2026-10-05: usuários `[DEV]` do `seed.dev.sql` não têm senha no repositório. O global-setup do Playwright define uma senha aleatória por execução via Admin API, e as chaves locais vêm de `supabase status` (nunca de arquivo versionado). `tests/ambiente.ts` recusa URLs que não sejam `127.0.0.1`/`localhost` (D11).
- 2026-10-05: sem Docker, a migration, os seeds e o teste pgTAP foram pré-checados num PGlite (Postgres em WASM, no scratchpad, fora do repositório) com um esboço do schema `auth` e um shim de pgTAP: 43/43. Isso NÃO conta como verificação dos itens, que seguem abertos até rodar `npm run test:db` no Supabase local.
- 2026-10-05: enquanto `database.types.ts` não pode ser gerado (sem banco local), as consultas validam o resultado com Zod. Tipos gerados em 2026-10-05 e ligados aos três clientes.
- 2026-10-05: no `config.toml`, `[auth] enable_signup = false` bloqueia o cadastro público; `[auth.email] enable_signup` precisa ficar `true`, porque desligá-lo desativa o login por e-mail ("Email logins are disabled"). Teste de integração prova `signup_disabled`.
- 2026-10-05: migration `privilegios_service_role`: `usage` em `privado` para o `service_role` (os triggers falhavam no criar-admin) e `revoke` de escrita na `auditoria` (os privilégios padrão do Supabase davam tudo ao `service_role`). Coberto por `002_service_role.test.sql`.
- 2026-10-05: o E2E roda contra `next build && next start`, não `next dev`: em dev o Next sobrescreve `Cache-Control` com `no-cache, must-revalidate`; em produção as páginas dinâmicas saem com `private, no-cache, no-store, max-age=0, must-revalidate`.
- 2026-10-05: `package.json` com `"type": "module"` (Vitest avisava sobre ESM carregado como CommonJS). O `criar-admin` roda com `--conditions=react-server` para que `server-only` resolva fora do Next.
- 2026-10-05: o PR da Fase 0 não tinha sido aberto (faltava o `gh`) e `main` ainda não tem a fundação. Aberto o PR #1 (`fase-0-fundacao` → `main`) e `fase-1-voucher` foi criada a partir de `fase-0-fundacao`, não de `main`: sem a fundação nada da Fase 1 funciona. O PR da Fase 1 fica empilhado sobre o #1; depois do merge do #1 ele mostra só os commits da Fase 1.
- 2026-10-05: `atividades.atrativo_id` existe desde já, mas a FK composta `(municipio_id, atrativo_id)` entra na Fase 2.1, junto com a tabela `atrativos`.
- 2026-10-05: regra no `privado` (security definer) e invólucros `security invoker` em `public` para a Data API; `EXECUTE` decide quem chama (service_role: emissão pública, token e limite; authenticated: assistida, conferência, confirmação, cancelamento e relatório). Erros de regra saem como `P0001` com uma chave curta (`sem_vagas`, `atividade_indisponivel`...), traduzida no servidor.
- 2026-10-05: D5 na prática: repetição da mesma chave devolve o mesmo voucher e **troca o token** (só o hash é guardado, então não dá para devolver o anterior). O link mais recente vale; a resposta anterior pode ter se perdido, que é o motivo da repetição. Requisições com a mesma chave são serializadas com `pg_advisory_xact_lock`.
- 2026-10-05: registro voluntário não tem sessões (trigger recusa); o visitante escolhe o dia (`data_visita`, hoje até 365 dias). Todo voucher grava `data_visita` no fuso America/Araguaina; confirmação só nesse dia e expiração no fim dele (reserva: fim da sessão + 2 h). Horário de sessão com vouchers não pode mudar.
- 2026-10-05: operador não lê a tabela `vouchers` (RLS só para gestor/admin). Ele confere pela função `conferir_voucher`, que devolve só os campos necessários, sem nome, contato ou token. A conferência e a confirmação expiram na hora um voucher vencido que o `pg_cron` (a cada 10 min) ainda não pegou.
- 2026-10-05: relatório filtra o período pelo dia da atividade (`data_visita`) e separa dois blocos: reservas (emitidos, utilizados, cancelados, expirados, pessoas reservadas, participações confirmadas) e registros voluntários (adesões e pessoas declaradas). Os totais do bloco de reservas são a soma das atividades em modo reserva (teste de coerência).
- 2026-10-05: auditoria de vouchers por trigger, sem `nome_responsavel`, `contato`, `token_hash` e `chave_idempotencia` (o trigger genérico ganhou um 2º argumento com colunas omitidas). Emissão e cancelamento não geram linha de auditoria de sessão só por mudar `pessoas_reservadas`.
- 2026-10-05: `src/lib/voucher/publico.ts` é o único módulo da aplicação que importa `privilegiado.ts` (D8.1 e D8.2), liberado em `tests/unit/privilegiado.test.ts`. O IP entra no limite só como SHA-256 (`x-forwarded-for`, 1º valor). O global-setup do E2E zera `limites_requisicao` no banco local, porque execuções seguidas saem do mesmo 127.0.0.1.
- 2026-10-05: a chave de idempotência (D5) é gerada no servidor a cada abertura da página de reserva (campo oculto) e reenviada nas novas tentativas do mesmo formulário.
- 2026-10-05: comprovante do visitante em `/voucher/<token>` (`Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `noindex`). "Salvar" baixa um PNG gerado no servidor com `next/og` em `/voucher/<token>/comprovante` (sem extensão no caminho, porque o matcher do proxy ignora `.png` e a reescrita por município não aconteceria); "Imprimir" usa `window.print()` com CSS de impressão (`print:hidden`).
- 2026-10-05: QR gerado com `uqr` (sem dependências) contendo só `XXXX-XXXX-XXXX`; teste decodifica a matriz com `jsqr` (dependência de desenvolvimento). Leitura pela câmera com `barcode-detector` (ponyfill da API BarcodeDetector sobre zxing-wasm, mantido): o `.wasm` fica em `public/vendor/` (servido pelo próprio site, sem CDN) e um teste confere o SHA-256 com a versão instalada. `.wasm` entrou na exclusão do matcher do proxy.
- 2026-10-05: o operador cai direto em `/admin/atendimento` e a barra inferior dele tem só Atendimento, Emitir voucher e Mais (a restrição completa das rotas é a Fase 4.3; as páginas de atividades já exigem gestor). A câmera só liga com toque em "Ler QR Code com a câmera" (permissão do navegador e privacidade); a digitação aceita minúsculas e hífens.
- 2026-10-05: o E2E testa a leitura real do QR: o Chromium recebe uma câmera falsa (`--use-file-for-fake-video-capture`) com um vídeo Y4M gerado em `tests/e2e/camera.ts` a partir da matriz do QR da própria aplicação. No Windows o Chromium não tem BarcodeDetector nativo, então o caminho testado é o ponyfill com o `.wasm` local. O estado "expirado" no E2E é forçado por `psql` no banco local (o prazo real é coberto no pgTAP).

## Registro

| Data | Item | Verificação |
|:-|:-|:-|
| 2026-10-05 | 0.1 | Pasta tinha só `CLAUDE.md`, `.env` (senha do banco remoto, não versionado) e `docs/` (PLANO, SPEC); sem git. Remoto `NeroSued/turismo.to` existe e estava vazio (API GitHub: 409 "Git Repository is empty"). Tudo preservado. |
| 2026-10-05 | 0.3 | `create-next-app@16.3.8` (App Router, TS strict, Tailwind 4, ESLint 9, src/); `package-lock.json` gerado. `npm run typecheck` (com `next typegen`), `npm run lint` e `npm run build` saíram com código 0. |
| 2026-10-05 | 0.4 | shadcn/ui (base-nova, Base UI) com button, input e label ajustados para 44px+/16px; lucide-react e Zod instalados; Atkinson Hyperlegible e Bricolage Grotesque via `next/font`; paleta e foco dourado de 3px em `globals.css`. `tests/unit/cores.test.ts` (4 testes) passa; typecheck, lint e build com código 0; captura em 390x844 confirmou fontes e fundo `rgb(238,240,234)`. |
| 2026-10-05 | 0.12 | `.gitignore` com `.env*` e `!.env.example`; `.env.example` só com valores públicos e chaves vazias. `tests/unit/segredos.test.ts` (4 testes) passa: só `.env.example` versionado, `git check-ignore` ignora `.env`, `.env.local` e `.env.production`, nenhum arquivo versionado com chave, JWT, URL com senha ou senha literal. Detector provado com um arquivo de vazamento simulado (falhou e voltou a passar após removê-lo). |
| 2026-10-05 | 0.2 | Node 24.18.0 (LTS), npm 11.16.0, git 2.56 com `origin` = github.com/NeroSued/turismo.to, Docker 29.8.2 (`docker info` responde, Docker Desktop 4.94), Supabase CLI 2.119.0 via `npx`. |
| 2026-10-05 | 0.5 | `npx supabase start` subiu a stack local; `npx supabase db reset` aplicou as 2 migrations e os 2 seeds. Clientes navegador, servidor (cookies, `@supabase/ssr`) e privilegiado (`server-only`) tipados com `database.types.ts` gerado por `supabase gen types --local`; servidor e privilegiado exercitados pelo E2E e pelo criar-admin. |
| 2026-10-05 | 0.6 | `npm run test:db`: 2 arquivos, 47 testes, PASS (RLS e políticas em todas as tabelas, funções definer com `search_path=''`, isolamento entre municípios, ninguém altera o próprio perfil/vínculo, auditoria por trigger com autor, service_role). `tests/integracao/api-publica.test.ts` confirma pela Data API que anônimo não lê perfis, vínculos e auditoria (42501). |
| 2026-10-05 | 0.7 | `db reset` aplicou `seed.sql` (7 municípios) e `seed.dev.sql` (4 usuários `[DEV]` com perfis e vínculos). Integração lista os 7 slugs pela API; E2E entra com os usuários `[DEV]`. |
| 2026-10-05 | 0.8 | E2E (build de produção, 390x844): hub lista os 7; `palmeiropolis.localhost:3000` abre o portal; `naoexiste.localhost` e `/m/palmeiropolis` direto respondem 404; `?municipio=peixe` ignorado sem `ALLOW_TENANT_OVERRIDE`, sem gravar cookie. Unitários do resolver (4 testes) cobrem override, preview e hosts maliciosos. |
| 2026-10-05 | 0.9 | E2E: `/admin` sem login redireciona para `/admin/login` com `Cache-Control` `private`+`no-store`; senha errada mostra erro; gestor de Palmeirópolis entra, vê "Painel · Gestor" e sai; gestor de Peixe em Palmeirópolis recebe "Sem acesso a este painel"; recuperação responde igual para conta existente e inexistente; rotas de cadastro dão 404; integração prova `signup_disabled`. |
| 2026-10-05 | 0.10 | `npm run criar-admin -- nova.admin@exemplo.test` no banco local: convite enviado (Mailpit recebeu "Convite para o painel Turismo.TO"), perfil marcado admin e registrado na auditoria; segunda execução idempotente. Link do e-mail → `/conta/nova-senha` → senha salva → login em Palmeirópolis mostra "Painel · Assessoria"; reuso do link → `/conta/link-expirado`. Documentado no README. |
| 2026-10-05 | 0.11 | Vitest (unidade + integração, 26 testes), pgTAP (47), Playwright 390x844 (11) e `npm run verify` encadeando typecheck, lint, test, test:db, test:e2e e build. `tests/unit/privilegiado.test.ts` falhou com uma importação proibida simulada e voltou a passar depois de removê-la. |
| 2026-10-05 | 1.1 | Migration `voucher_tabelas` aplicada por `npx supabase db reset`. pgTAP `003_voucher.test.sql`: RLS ativa nas 4 tabelas; anônimo não lê `vouchers` nem `limites_requisicao` (42501), vê só atividades publicadas e sessões de publicadas; gestor de B não cria atividade em A; gestor não altera `pessoas_reservadas`; capacidade não fica abaixo do reservado (23514). |
| 2026-10-05 | 1.2 | `npm run test:db`: 3 arquivos, 122 testes, PASS (75 do voucher: emissão, idempotência, sem vagas, token só como hash, token errado = inexistente, cancelamento devolve as pessoas, confirmação repetida, cancelado, expirado, fora do dia, outro município, `pg_cron` agendado). `tests/integracao/voucher.test.ts` (8) pela Data API: 30 emissões simultâneas → 8 aceitas, 15 pessoas = `pessoas_reservadas`; mesma chave 10× → 1 voucher; coerência do relatório. |
| 2026-10-05 | 1.3 | `tests/e2e/voucher.spec.ts` (build de produção, 390x844): gestor de Palmeirópolis entra, cria atividade de reserva (começa em elaboração), adiciona horário com 15 vagas, publica; outra atividade: horário sem limite → vagas 8, marca nome do responsável e condições, salva e arquiva; atividade arquivada some do portal. 2/2 PASS. Typecheck e lint limpos; `tests/unit/datas.test.ts` (5) cobre o fuso America/Araguaina. |
| 2026-10-05 | 1.4 | E2E (390x844): o portal lista a atividade publicada; a página "Reserva gratuita" mostra data, horário, "Restam 15 vagas", contador de pessoas, cidade/UF e aviso de privacidade; visitante reserva 3 pessoas e é levado ao comprovante. Atividade arquivada some do portal. Unitários: 42/42 (inclui o guarda do `privilegiado.ts` com o novo módulo permitido). |
| 2026-10-05 | 1.5 | E2E: comprovante com "Voucher emitido", município, "Gratuito", atividade, origem, 3 pessoas, código `XXXX-XXXX-XXXX` e QR (`role=img`); página com `no-store` e `no-referrer`; "Salvar" devolve PNG válido (`image/png`, assinatura PNG, `no-store`); na mídia de impressão somem botões e o link de cancelamento e o cartão fica; cancelamento pelo link devolve as vagas (12 → 11 → 12); token errado e malformado: "Voucher não encontrado". `tests/unit/qr.test.ts`: QR decodificado pelo jsQR contém só o código. |
| 2026-10-05 | 1.6 | E2E (390x844): operador entra e cai em Atendimento (barra: Atendimento, Emitir voucher, Mais); liga a câmera falsa com o QR do voucher e a leitura abre a conferência ("Reservado · válido para hoje", código, atividade, 3 pessoas, Gurupi/TO, sem nome/contato); diminui para 2 e confirma → "Participação confirmada", "2 de 3", nome do operador; nova leitura digitada em minúsculas → "Voucher já utilizado ... com 2 pessoas ... Nenhuma nova contagem"; telas de cancelado, expirado e código inexistente sem botão de confirmar; código malformado → "Código inválido"; gestor de Peixe → "Voucher de outro município ... não pertence a Peixe", sem o nome da atividade. 7/7 PASS. |
| 2026-10-05 | 1.7 | E2E (390x844): operador abre "Emitir voucher para visitante sem celular", escolhe a atividade, vê "Restam 11 vagas", emite para 2 pessoas de Arraias pela própria sessão (função `emitir_voucher_assistido`, sem service_role); comprovante com "Voucher emitido. Imprima...", origem, 2 pessoas, código e QR; na impressão somem a barra do painel e os botões e o cartão fica; o mesmo código é confirmado no atendimento ("2 de 2"). 8/8 PASS. pgTAP já cobre origem `assistida` e `emitido_por`. |
