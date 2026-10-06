# Plano de execução: Turismo.TO

Como usar este arquivo:

- Cada fase tem itens, critérios de aceite ("Pronto quando") e o comando `/goal` pronto para colar.
- Marque `[x]` só depois de verificar. Registre cada item concluído em "Registro".
- Entre uma fase e outra, rode `/clear` no Claude Code e cole o `/goal` da fase seguinte. O estado fica neste arquivo, não na conversa.

## Estado

- Fase ativa: **6** (Fase 5 concluída; PRs das fases 0 a 5 mesclados em `main`; o merge da Fase 5 foi aprovado pelo Nero porque a Vercel publica `main` em produção)
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
4. Convite para a equipe (Fase 4.2): encontrar a conta pelo e-mail ou criá-la pelo convite do Auth, só depois de a action conferir com a sessão de quem convida que ela é gestora do município do convite (ou admin). O vínculo é gravado com a sessão de quem convida, sob a RLS.

5. Script `backup-storage` (Fase 5.7): exporta e reimporta os arquivos dos buckets `publico` e `interno`, que o backup do banco não inclui. Roda só numa máquina confiável, nunca no servidor web.

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
- [x] 1.8 Relatório básico do período: vouchers emitidos, utilizados, cancelados e expirados; pessoas reservadas; participações confirmadas; registros voluntários. Cada número com rótulo que não confunda reserva com visita.
- [x] 1.9 Auditoria de emissão assistida, confirmação, cancelamento e alterações de atividade.

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

- [x] 2.1 Migrations: `atrativos`, `eventos` (atrativo opcional), `prestadores`, `adesoes_prestador` (data, responsável, comprovante privado), `fotos` com legenda. Estados rascunho, publicado e arquivado.
- [x] 2.2 Buckets `publico` e `interno` com políticas por pasta `<municipio_id>/`; limites: fotos JPEG, PNG ou WebP até 5 MB; documentos PDF, JPEG ou PNG até 10 MB.
- [x] 2.3 Painel: cadastro de atrativos, eventos e prestadores com formulários curtos, upload de fotos e estados vazios úteis.
- [x] 2.4 Configurações do município: nome de exibição, logo, cor primária (com validação de contraste), contato da Secretaria de Turismo, link da Ouvidoria oficial, texto do aviso de privacidade, referência da cartilha do ICMS Ecológico.
- [x] 2.5 Portal público conforme a tela "Portal municipal": apresentação, atividades com voucher, eventos e calendário, atrativos, rede de prestadores, contato, Ouvidoria e aviso de privacidade.
- [x] 2.6 Metadados por município (título, descrição, Open Graph) e imagens otimizadas.

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

- [x] 3.1 Relatórios por município, período e ano-base: emitidos, utilizados, cancelados, expirados, participações confirmadas, registros voluntários, origem por cidade e UF, atividades e prestadores envolvidos.
- [x] 3.2 Exportação CSV e versão para impressão ou PDF pelo navegador.
- [x] 3.3 Versão para divulgação, sem nome, contato ou qualquer dado pessoal.
- [x] 3.4 Evidências: tipo da ação, descrição, data de realização, responsável, fotos com legenda, anexos (listas de presença, atas e outros), ano-base. Data de realização separada da data de inclusão.
- [x] 3.5 Histórico de alterações de evidências com autoria.
- [x] 3.6 Minuta do relatório de implantação: atividades, indicadores, evidências, seções editáveis de metodologia, limitações, análise e recomendações, campos em branco para identificação e assinatura do gestor, aviso de que não substitui a análise estadual.

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

- [x] 4.1 Área do admin da assessoria: lista de municípios, ativar e desativar, acesso às configurações de cada um.
- [x] 4.2 Convite de usuário por e-mail com papel e município; alterar papel; desativar vínculo.
- [x] 4.3 Menu do operador restrito a atendimento e emissão assistida.
- [x] 4.4 Página de auditoria com filtros por município, usuário, período e tipo de ação.
- [x] 4.5 Exclusão definitiva de arquivo de evidência a pedido do titular (LGPD): só o admin da assessoria; apaga o arquivo do Storage e mantém no histórico quem removeu, quando e o motivo, sem guardar cópia do arquivo. Gestor e operador não conseguem.

**Pronto quando:**

- Gestor não se promove nem promove outro usuário a admin, nem cria vínculo em outro município (pgTAP e teste de rota).
- Operador não acessa conteúdo, relatórios, evidências nem configurações (E2E).
- Convite cria usuário sem senha compartilhada; o próprio convidado define a senha.
- Exclusão LGPD apaga o arquivo do Storage e registra no histórico quem, quando e o motivo; gestor e operador não conseguem (teste).
- `npm run verify` termina com código 0.

```
/goal Fase 4 de docs/PLANO.md concluída: itens 4.1 a 4.4 marcados [x] com linha no Registro, os testes de escalada de privilégio, de restrição do operador e de convite passam e aparecem na conversa, npm run verify termina com código 0 e você colou a lista "Pronto quando" da Fase 4 com o resultado de cada critério. Siga o CLAUDE.md. Se houver bloqueio, registre, escreva BLOQUEADO com o motivo e pare. Pare após 50 turnos.
```

---

## Fase 5: Privacidade, qualidade e documentação

- [x] 5.1 Rotina de anonimização (D10) com prazo configurável por município.
- [x] 5.2 `docs/PRIVACIDADE.md`: finalidade, dados coletados, retenção, quem acessa, procedimento de exclusão e anonimização. Texto padrão do aviso de privacidade, marcado para revisão jurídica da prefeitura.
- [x] 5.3 Revisão de acessibilidade e desempenho no celular em todas as telas, incluindo o painel.
- [x] 5.4 `README.md`: instalação, Supabase local e remoto, variáveis, domínio, implantação na Vercel, criação do primeiro admin.
- [x] 5.5 `docs/MANUAL.md`: manual curto para gestores e operadores, com o passo a passo de cada tarefa comum.
- [x] 5.6 `docs/CUSTOS.md`: planos e custos recorrentes (Vercel, Supabase, domínio, SMTP), sem presumir que plano gratuito serve ao uso comercial. Conferir preços atuais nas páginas oficiais e citar a data.
- [x] 5.7 `docs/BACKUP.md`: backups do Supabase conforme o plano contratado, exportação periódica do banco e do Storage, procedimento de restauração testado localmente.
- [x] 5.8 Corrigir a confirmação que some da tela ao remover o acesso de administrador de alguém.
- [x] 5.9 Na exclusão a pedido do titular (LGPD), substituir também a legenda do arquivo nos registros do histórico por "[removido a pedido do titular]", com teste.

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

- [x] 6.1 Vincular o projeto remoto "Turismo.TO" e aplicar as migrations com `supabase db push`, só com `seed.sql` (municípios).
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
- [ ] Chave secreta (`sb_secret_...`) e chave publicável do projeto remoto apareceram na conversa do Claude Code em 2026-10-05, no início da Fase 4: o `.env` passou a ter as chaves soltas, sem nome, e o comando de mascaramento só cobria linhas com `=` ou `:`. Nero deve revogar a chave secreta e criar outra em Project Settings → API Keys. O arquivo também deixou de ser lido pelo Supabase CLI (formato inválido) e foi renomeado, sem mudar o conteúdo, para `.env.chaves-remotas` (continua fora do git pelo `.gitignore`).
- [ ] Acesso à Vercel (equipe e projeto).
- [x] Compra do domínio `turismo.to`. Resolvido: o Nero informou em 2026-10-05 que o domínio já está registrado por ele (a consulta da Vercel e o whois mostram o nome como registrado; o anúncio do Sedo no whois é da página de consulta, não uma oferta do domínio). Custos de renovação em `docs/CUSTOS.md`.
- [x] Apontar os nameservers de `turismo.to` para a Vercel. Resolvido pelo Nero em 2026-10-05; conferido no servidor do `.to` (`ns01.trs-dns.net`), que delega para `ns1.vercel-dns.com` e `ns2.vercel-dns.com`. Resolvedores públicos ainda mostravam os nameservers antigos do Spaceship por cache.
- [x] Conta no Resend para o e-mail transacional (decisão do Nero em 2026-10-05: Resend, subdomínio de envio `envio.turismo.to`, configurado como SMTP personalizado no Supabase Auth; registros DNS do Resend no DNS da Vercel). Conta criada pelo Nero em 2026-10-05.
- [ ] Configurar o Resend: adicionar o domínio `envio.turismo.to`, copiar os registros DNS que o Resend mostrar para o DNS da Vercel, esperar a verificação, criar uma chave de API só de envio e colá-la no SMTP do Supabase Auth. Passo a passo em `README.md`. Faz parte da Fase 6.2 (precisa do Nero, porque a chave é secreta).
- [x] Aprovação do Nero para mesclar o PR #6 (Fase 5) em `main`. Em 2026-10-05 o PR estava sem conflito e com `npm run verify` em código 0, mas já tem o check "Vercel" (o projeto da Vercel está ligado ao repositório), então o merge publica em produção e, pela regra do CLAUDE.md, só acontece com aprovação explícita. Resolvido: o Nero aprovou ("Pode publicar") em 2026-10-05.
- [ ] Fase 6 (2026-10-06, atualizado): o Nero preencheu `.env.deploy`. `VERCEL_TOKEN` funciona; a senha de produção funciona. O campo `SUPABASE_ACCESS_TOKEN` veio com a chave secreta do projeto de produção (`sb_secret_...`), não com um token pessoal (`sbp_...`); a API de gerenciamento recusa (401). A chave foi movida para `SUPABASE_SECRET_KEY_PROD` (usada pelo `criar-admin`). Ainda faltam: (1) token pessoal `sbp_...` da conta dona dos dois projetos, para configurar o Auth (Site URL, redirecionamentos, templates), ler os advisors e buscar as chaves do projeto de teste; (2) na Vercel, a variável `SUPABASE_SECRET_KEY_TEST` está em Production: editar o nome para `SUPABASE_SECRET_KEY` e o ambiente para só Preview; (3) SMTP do Resend no projeto "Turismo.TO Teste", remetente `teste@envio.turismo.to`.
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
- 2026-10-05: regra de Git alterada pelo Nero no início da Fase 3: com `npm run verify` em código 0 e todos os critérios atendidos, o agente mescla o PR em `main` e apaga a branch (CLAUDE.md, seção Git). `fase-3-relatorios` criada a partir de `main` atualizada (PRs #1 a #3 já mesclados).
- 2026-10-05: "prestadores envolvidos" = prestadores indicados como responsáveis por atividades com vouchers no período. Para isso a atividade ganhou `prestador_id` opcional (FK composta, campo "Prestador responsável" na edição da atividade); o relatório também mostra a rede (participantes hoje e adesões registradas no período, só o nome público).
- 2026-10-05: versão para divulgação = só agregados. Sem código de voucher, nome, contato, linha individual ou nome de prestador (pode ser pessoa física, aparece só a categoria). Cidades e UFs com menos de 3 vouchers/registros no período são somadas em "Outras cidades"/"Outras UFs", para ninguém ser identificável pela origem. O CSV administrativo também não traz nome nem contato (minimização); traz códigos e cidade. CSV com `;`, BOM UTF-8 e neutralização de fórmulas (`=`, `+`, `-`, `@`).
- 2026-10-05: relatório por ano-base (`?ano=2026`, padrão = ano corrente) ou período livre (`?inicio=&fim=`), sempre pelo dia da atividade. PDF pelo "Imprimir ou salvar PDF" do navegador, com CSS de impressão (sem navegação, filtros e botões).
- 2026-10-05: evidência não é excluída, é arquivada (sai da lista e da minuta, fica no histórico). Data de realização futura recusada no servidor e no banco (fuso America/Araguaina). Autoria (`criado_por`, `atualizado_por`) e datas gravadas pelo banco; `criado_por` e `criado_em` não são colunas liberadas para escrita.
- 2026-10-05: histórico de evidências em tabela própria (`evidencias_historico`), preenchida só por trigger `security definer`, com campos alterados, valores antes/depois, autor e horário; registra também inclusão, remoção e troca de legenda de arquivos. O nome do autor é guardado no registro porque o gestor não lê `perfis` de outras pessoas. A tabela `auditoria` continua recebendo tudo, como nas outras tabelas.
- 2026-10-05: fotos de evidência ficam no bucket `interno` (podem mostrar pessoas), JPEG ou PNG até 5 MB (tipo `foto_interna`); listas de presença, atas e outros anexos seguem a regra de documentos (PDF, JPEG ou PNG até 10 MB). Arquivos abrem por `/admin/evidencias/<id>/arquivos/<arquivo>`, que confere o gestor e redireciona para URL assinada de 60 s com `private, no-store`.
- 2026-10-05: minuta montada por um módulo puro (`src/lib/minuta/conteudo.ts`) que não recebe nome de usuário: identificação e assinatura são só rótulos com linha em branco. Metodologia, limitações, análise e recomendações ficam em `minutas_relatorio` (por município e ano-base) e aparecem como "[A preencher pelo responsável: ...]" até o gestor escrever. O texto não fala em pontuação, aprovação, conselho nem publicação; a referência da cartilha vem de `referencia_icms`.
- 2026-10-05: Visão geral segue o canvas: o terceiro atalho virou "Nova evidência" e as pendências incluem "N evidências sem anexo". O E2E da Fase 1 que usava o atalho "Nova atividade" agora vai por Conteúdo > Atividades com voucher (o que ele verifica não mudou). A nota do indicador de registros voluntários mantém o texto do canvas ("adesões, não o fluxo total").
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
- 2026-10-05: `fase-2-portal` criada a partir de `fase-1-voucher`, não de `main`: após `git fetch`, `main` ainda não contém a Fase 1 (PRs #1 e #2 abertos). O PR da Fase 2 fica empilhado sobre o #2.
- 2026-10-05: contatos internos e comprovante ficam numa tabela separada, `adesoes_prestador` (só gestor e admin leem; sem `GRANT` para `anon`), em vez de colunas escondidas em `prestadores`. Assim nenhuma consulta pública alcança esses dados, nem por engano de `select *`. `prestadores.contatos_publicos` guarda só o que o prestador autorizou divulgar.
- 2026-10-05: caminhos de arquivo sempre `<municipio_id>/<pasta>/<arquivo>`, conferidos por `privado.caminho_do_municipio` em `fotos`, `adesoes_prestador` e `configuracoes_municipio` (logo e capa), e pela pasta nas políticas do Storage. Cor primária recusada no banco com contraste < 4.5:1 (`privado.contraste_com_branco`), além da validação no servidor.
- 2026-10-05: configurações ganharam `capa_caminho` (foto de capa do portal), para a imagem do topo da tela "Portal municipal" não depender de foto inventada.
- 2026-10-05: o bucket `publico` não tem política de leitura em `storage.objects`: as fotos saem pela URL pública do bucket e o anônimo não consegue listar a pasta. Uma foto de conteúdo em rascunho tem URL pública, mas imprevisível (UUID) e só aparece no painel; a tabela `fotos` só mostra ao público as de conteúdo publicado.
- 2026-10-05: correção pedida pelo Nero junto com a Fase 2: o botão "Emitir voucher para visitante sem celular" não mostrava a borda escura do canvas. Causa: `buttonVariants` era chamado fora do `cn` nos `<Link>`, então `border-transparent`/`border-border` competiam com `border-foreground`. Agora `buttonVariants` sempre mescla as classes e há a variante `contorno` (1,5px em `#16211B`), usada também em "Registrar minha visita".
- 2026-10-05: formulários curtos no painel: criar pede só os campos essenciais (nome e categoria, ou nome, datas e local); endereço, horários, fotos, adesão e o resto ficam na tela de edição. Depois de um erro, a action devolve os valores enviados, porque o React 19 reseta o formulário ao fim da action.
- 2026-10-05: server actions aceitam até 11 MB (`experimental.serverActions.bodySizeLimit`), para documentos de 10 MB; o tamanho e o tipo real de cada arquivo são conferidos no servidor antes do envio ao Storage, que repete os limites.
- 2026-10-05: portal conforme a tela "Portal municipal": capa (ou espaço reservado com o aviso "[Foto oficial cedida pela prefeitura]"), botões "Reservar atividade gratuita" e "Registrar minha visita" (este só quando há registro voluntário publicado), atividades com selo e próximo horário, 3 próximos eventos com bloco de data, 6 atrativos em grade, categorias da rede e rodapé com Secretaria, Ouvidoria (nova aba), aviso de privacidade e outros municípios. Páginas novas: `/atrativos`, `/atrativos/<id>`, `/eventos` (calendário por mês), `/eventos/<id>`, `/prestadores` (filtro por categoria) e `/privacidade`. Rascunho e arquivado respondem 404 por URL direta. Prestador desligado sai da lista pública.
- 2026-10-05: a cor primária do município não era aplicada nas páginas (defeito da Fase 1): `--primary` é calculada no `:root` e herdada já resolvida. O layout municipal agora redefine `--primary` e `--secondary-foreground` junto com `--cor-municipal`.
- 2026-10-05: imagens do portal com `next/image` (AVIF/WebP, `sizes` por uso) a partir do bucket `publico`; `remotePatterns` limitado a `/storage/v1/object/public/publico/**` do Supabase configurado, e `dangerouslyAllowLocalIP` ligado só quando esse Supabase é local (127.0.0.1/localhost).
- 2026-10-05: testes de integração rodam em arquivos paralelos e cada `entrarComo` define uma senha aleatória para o mesmo usuário `[DEV]`; o login agora tenta de novo se outro arquivo trocou a senha no meio (a sessão já aberta continua válida).
- 2026-10-05: o Chromium do E2E (densidade 1) arredonda a borda de 1,5px para 1px; o teste aceita 1px ou 1,5px e exige a cor `#16211B`.
- 2026-10-05: início da Fase 4: `main` atualizada, branches `fase-0-fundacao`, `fase-1-voucher` e `fase-2-portal` (já mescladas) apagadas no local e no GitHub, `fase-4-admin` criada a partir de `main` e banco local zerado com `npx supabase db reset`. O `.env` com as chaves remotas impedia o `db reset` ("failed to parse environment file") e foi renomeado para `.env.chaves-remotas` (ver Bloqueios).
- 2026-10-05: item 4.5 incluído a pedido do Nero no `/goal` da Fase 4. Para "gestor não consegue excluir de vez", o gestor deixou de apagar arquivos de evidência: o botão virou "Retirar" (coluna `retirado`; o arquivo sai da tela e da minuta, mas fica guardado e o histórico registra "Retirou da evidência"; retirado não volta). Ninguém tem `DELETE` em `evidencias_arquivos`; a política do Storage não deixa o gestor apagar nem sobrescrever objeto ligado a um arquivo de evidência (ele ainda limpa um envio que falhou antes de virar arquivo). O pgTAP da Fase 3 que apagava o anexo como gestor passou a retirá-lo (mesma sequência no histórico) e ganhou um teste de que apagar dá 42501.
- 2026-10-05: exclusão LGPD em duas etapas, sempre com a sessão do admin: (1) o servidor apaga o objeto pela API do Storage (o banco não permite apagar `storage.objects` diretamente); (2) `excluir_arquivo_evidencia_lgpd` confere que o objeto não existe mais (senão recusa com `arquivo_ainda_no_storage`), registra `arquivo_excluido_lgpd` com autor, horário, tipo e motivo (sem legenda, que pode ter nome da pessoa) e apaga a linha. Se a etapa 2 falhar, repetir funciona. A legenda continua nos registros anteriores do histórico e na auditoria (texto digitado, não o arquivo); a assessoria pode tratar isso caso a caso.
- 2026-10-05: equipe (4.2): o gestor gerencia gestores e operadores do município em que é gestor; o admin, de qualquer município. Ninguém cria, altera ou desativa o próprio vínculo. Vínculo só aceita `papel` e `ativo` em alterações (privilégio por coluna), então não muda de usuário nem de município; excluir vínculo continua só do admin (o caminho normal é desativar). Autorização sempre pelo município do recurso (`municipio_id` do formulário conferido com a sessão em `contextoDoMunicipio`), nunca pelo host. Formulário com campo a mais (ex.: `admin_assessoria`) é recusado (Zod `strictObject`).
- 2026-10-05: convite: conta nova recebe o e-mail do Auth (template com `token_hash`) com link para o subdomínio do município; a pessoa cria a própria senha em `/conta/nova-senha`. Conta que já existe só ganha o vínculo e entra com a senha que já usa. O nome digitado só é gravado em conta nova. Gestor vê nome, e-mail e "Ainda não entrou" da equipe pela função `equipe_do_municipio` (ele não lê `perfis` de outras pessoas).
- 2026-10-05: área da assessoria (4.1) em `/admin/assessoria`, aberta no painel de qualquer município ativo (o admin passa em todos). Configurações e equipe de cada município, inclusive desativado, em `/admin/assessoria/<slug>`, sem trocar de subdomínio (a sessão é por host). Município desativado continua respondendo 404 no portal e no painel, como manda o CLAUDE.md; o admin não desativa o município em cujo painel está. Conceder ou remover admin só para conta existente e nunca para si (o trigger da Fase 0 confere de novo); conta nova continua pelo `criar-admin`.
- 2026-10-05: auditoria (4.4) em `/admin/auditoria` pela função `auditoria_consultar`: gestor vê só o município do painel (parâmetro `municipio` ignorado); admin escolhe um município ou "Todos". Filtros por pessoa, período (fuso America/Araguaina, padrão últimos 30 dias), área (tabela) e tipo de ação (inclusão, alteração, exclusão), 50 por página. Mostra os campos alterados, não os valores (podem ter dados pessoais).
- 2026-10-05: o "teste de rota" do convite e da promoção a admin reenvia a requisição real da server action: o formulário do gestor é enviado com o `municipio_id` de Peixe ou com o campo `admin_assessoria`, e a action "Tornar administrador", capturada do painel do admin, é reenviada com os cookies do gestor (para ele mesmo e para outra pessoa). As três respostas trazem "sem permissão", e o banco confirma que nenhuma conta, vínculo ou perfil de admin mudou.
- 2026-10-05: início da Fase 5: `main` atualizada, `fase-5-qualidade` criada a partir dela e banco local zerado com `npx supabase db reset`. Itens 5.8 e 5.9 incluídos a pedido do Nero no `/goal` da fase. Decisão do Nero sobre e-mail: Resend com subdomínio de envio (`envio.turismo.to`) como SMTP personalizado do Supabase Auth; o domínio usará os nameservers da Vercel e os registros DNS do Resend vão no DNS da Vercel.
- 2026-10-05: anonimização (5.1) pela função `privado.anonimizar_vouchers()`, agendada no `pg_cron` todo dia às 00:15 de Araguaína: apaga `nome_responsavel` e `contato` e grava `anonimizado_em` quando o dia da atividade (`data_visita`) somado ao prazo do município (`dias_anonimizacao`, padrão 90) chega a hoje, em qualquer estado do voucher. Cidade, UF, pessoas, atendidas e estado ficam, então os relatórios não mudam. O gestor edita o prazo em Configurações; a tela aceita de 7 a 3650 dias (o banco aceita de 1 a 3650), para o contato não sumir antes de resolver pendências da visita.
- 2026-10-05: item 5.9 substitui a decisão da Fase 4 de deixar a legenda nos registros anteriores. O histórico ganhou `arquivo_id` (preenchido pelo trigger na inclusão, troca de legenda, retirada e exclusão). A exclusão LGPD troca a chave `legenda` por "[removido a pedido do titular]" em todos os registros do histórico ligados ao arquivo (os gravados antes da coluna existir são achados pela evidência e pelo texto exato da legenda) e também na `auditoria` do arquivo, inclusive na linha da própria exclusão. Autor, horário, tipo e motivo ficam. O E2E da Fase 4 que esperava ver a legenda na linha "Retirou da evidência" passou a exigir o texto de substituição e a ausência da legenda.
- 2026-10-05: item 5.8: "Remover acesso de administrador" ficava dentro do item da lista; quando a pessoa deixava de ser admin, o item saía da lista e levava a confirmação junto. A lista virou um componente cliente (`ListaAdmins`) que guarda o resultado acima dela, como a exclusão LGPD da Fase 4, e a confirmação cita a pessoa ("Acesso de administrador de X removido.").
- 2026-10-05: revisão 5.3 em `tests/e2e/acessibilidade.spec.ts`, que cria os próprios dados `[DEV]` e confere que cada URL abriu a página certa (status e caminho, sem redirecionamento escondido) antes do axe. Regras: WCAG 2.0, 2.1 e 2.2 nível A e AA (inclui tamanho de alvo de toque). A página de token inválido responde 200 com "Voucher não encontrado" (D6), não 404. Orçamento de desempenho no celular (4G simulado: 150 ms, 1,6 Mbit/s; processador 4x mais lento; sem cache do navegador): maior conteúdo visível em até 2,5 s ("bom" do Core Web Vitals) e até 350 KB de JavaScript comprimido nas telas mais usadas. Corrigido no caminho: o aviso "Horários e orientações ... ainda não foram informados" ficava dentro do `<dl>` no atrativo sem informações (violação séria `definition-list`).
- 2026-10-05: backup (5.7): banco por `supabase db dump` (papéis, estrutura e dados com `--use-copy`) e arquivos pelo script novo `backup-storage` (operação privilegiada D8.5), porque o backup do Supabase não inclui o Storage. O dump de dados exclui com `-x` os buckets (criados pelas migrations) e tabelas internas do Storage que o `postgres` não grava; sem isso a restauração falhou no ensaio. Restauração = migrations (`db push`) + `data.sql` em transação única com `session_replication_role = replica` (auditoria e histórico vêm da cópia, sem gerar linhas novas) + `backup-storage importar`. O ensaio local ficou em `scripts/ensaio-restauracao.sh`, que recusa `.env.local` fora do Supabase local.
- 2026-10-05: a validação do README em clone limpo (5.4) falhou no build do E2E: o `next/font/google` baixou o CSS da Bricolage Grotesque, mas não os arquivos de fonte ("Can't resolve '@vercel/turbopack-next/internal/font/google/font'"). No repositório principal passava porque as fontes estavam no cache da `.next`. As fontes passaram a vir dos pacotes `@fontsource/atkinson-hyperlegible` e `@fontsource/bricolage-grotesque` (OFL-1.1, versões fixas no lock) por `next/font/local`, só o subconjunto latin (cobre o português), pesos 400/700 e 500/700 como antes. O build não depende mais da rede para fontes, também na Vercel. O E2E confere que as 4 fontes carregam e que não há link para o Google.
- 2026-10-05: a segunda validação em clone limpo pegou dois problemas que só aparecem com todos os E2E juntos num banco novo: (1) contraste do botão principal com o mouse em cima: o hover usava a cor com 80% de opacidade e caía para 3,27:1; agora o hover escurece a cor (`color-mix` com 15% de preto) e o `acessibilidade.spec` confere o contraste com o mouse sobre o botão; (2) os dados de teste do `acessibilidade.spec` usavam o prefixo `[DEV]`, que o E2E do relatório usa para provar que não há dado pessoal na tela; passaram a usar `[E2E]`, como os demais conteúdos criados por E2E.
- 2026-10-05: a terceira validação em clone limpo mostrou uma corrida no E2E da assessoria (Fase 4): depois do segundo "Salvar configurações", o teste esperava a mensagem "Configurações salvas", que ainda estava na tela desde o primeiro salvamento, e rodava o axe com o botão em "Salvando…" (desativado, isento de contraste pela WCAG 1.4.3). O teste agora espera o botão voltar a ficar ativo e confere no banco que o nome de exibição foi limpo; a verificação do axe não mudou.
- 2026-10-06: início da Fase 6: `fase-6-implantacao` criada a partir de `main`. Regras do `/goal`: Preview usa o projeto Supabase separado "Turismo.TO Teste" (ref `lcpkzcjkijgtomoepcbe`); produção recebe só `seed.sql`; dados fictícios só no local e no projeto de teste; merge em `main` só com aprovação do Nero.
- 2026-10-06: `ALLOW_TENANT_OVERRIDE` existia em Production na Vercel e `https://turismo.to/?municipio=palmeiropolis` abria o portal e gravava o cookie (contra o CLAUDE.md). A variável foi apagada de Production; passa a valer no próximo deploy de produção (o merge desta fase). O teste de fumaça confere que `?municipio=` é ignorado em produção.
- 2026-10-06: Preview na Vercel: `NEXT_PUBLIC_ROOT_DOMAIN=teste.turismo.to`, `NEXT_PUBLIC_SUPABASE_URL` do projeto de teste e `ALLOW_TENANT_OVERRIDE=true`. `CRON_SECRET` aleatório (32 bytes) criado em Production como Sensitive; cópia só no `.env.deploy`. A Proteção de Deploy da Vercel está em "todos exceto domínios próprios", então os aliases `*.teste.turismo.to` do E2E abrem sem o acesso de automação (só mostram dados fictícios do projeto de teste).

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
| 2026-10-05 | 1.8 | `/admin/relatorios` (gestor/admin; período pelo dia da atividade, padrão = ano-base) com blocos "Reservas gratuitas" e "Registros voluntários", resumo por atividade e lista de vouchers sem nome/contato; Visão geral com os indicadores do canvas, "Hoje" e pendências. E2E: relatório mostra o voucher reservado como "Utilizado" com "3 reservadas · 2 atendidas", o cancelado, o expirado e o assistido; resumo da atividade "4 emitidos · 2 utilizados · 1 cancelados · 1 expirados" e "6 pessoas reservadas · 4 participações confirmadas"; notas "reservas feitas, não visitas", "não são turistas únicos", "adesões, não o fluxo total". Teste de coerência (integração) confere os números com os vouchers criados. E2E completo: 20/20. |
| 2026-10-05 | 1.9 | Triggers de auditoria em `atividades`, `sessoes` (só mudanças do gestor) e `vouchers` (sem nome, contato, token e chave). pgTAP 127/127: emissão assistida, confirmação, cancelamento pelo painel (operador) e pelo visitante (sem usuário), mudança de vagas com o gestor, nenhuma linha de sessão por emissão, gestor de B não lê a auditoria de A. Integração pela API: o gestor lê a trilha `atividades:INSERT/UPDATE (gestor) · vouchers:INSERT (operador) · UPDATE utilizado (operador) · UPDATE cancelado (gestor)`, sem o nome do responsável; operador e gestor de Peixe não leem. |
| 2026-10-05 | Fase 1 | `npm run verify` com código 0: typecheck, lint, Vitest 43/43, pgTAP 127/127, Playwright 20/20 (390x844, build de produção), build. Integração do voucher 9/9 (concorrência, idempotência, confirmação repetida, cancelado, outro município, anônimo/operador sem leitura direta, token errado, coerência do relatório, auditoria). Seletor do E2E da emissão assistida passou a ignorar o anunciador de rotas do Next (falha intermitente de seletor, não da tela). |
| 2026-10-05 | 2.1 | Migration `portal_cadastros` aplicada por `npx supabase db reset`; tipos regenerados. pgTAP `004_portal.test.sql` (47) e suíte completa 174/174 PASS: RLS nas 5 tabelas; anônimo vê só atrativo, evento, prestador e fotos publicados de município ativo; arquivar tira atrativo e foto das consultas anônimas; anônimo e operador não leem `adesoes_prestador`; gestor de B não vê rascunhos de A nem altera nada de A; FKs compostas recusam evento, foto, atividade e adesão apontando para outro município (23503); foto com caminho de outra pasta ou com `..` recusada; cor com contraste baixo recusada; auditoria grava o gestor. |
| 2026-10-05 | 2.2 | Migration `storage_buckets`: `publico` (público, 5 MB, JPEG/PNG/WebP) e `interno` (privado, 10 MB, PDF/JPEG/PNG), políticas só para o gestor da pasta `<municipio_id>/`. pgTAP confere a configuração dos buckets e as políticas. `tests/integracao/storage.test.ts` (6) contra o Storage local: foto do gestor sai pela URL pública; bucket recusa PDF/texto e foto > 5 MB, WebP e documento > 10 MB no `interno`; gestor de Peixe não grava, não lista, não baixa e não assina URL na pasta de Palmeirópolis; anônimo e operador não leem o `interno`; gestor baixa por URL assinada de 60 s. `tests/unit/upload.test.ts` (6): tipo pelos bytes iniciais (SVG, GIF, texto e PDF renomeado recusados como foto) e limites. |
| 2026-10-05 | 2.3 | Painel: Conteúdo (atrativos, eventos, atividades e prestadores com contagem por estado), listas por estado com estados vazios, formulários curtos de criação, edição completa, publicar/voltar/arquivar, fotos com legenda obrigatória e adesão com comprovante no bucket interno (aberto por URL assinada de 60 s). E2E `portal.spec.ts` (390x844, build de produção): gestor cria, edita, publica e arquiva; foto texto-com-nome-de-jpg recusada ("Tipo de arquivo não aceito"), "JPEG" de 6 MB recusado ("limite é 5 MB"), PNG válido aceito; evento com término antes do início recusado no campo; comprovante não-PDF recusado, PDF aceito, link do comprovante responde 303 para URL assinada com `no-store`; operador mandado de volta ao atendimento. Typecheck e lint limpos. |
| 2026-10-05 | 2.4 | `/admin/configuracoes` (gestor; atalho em Mais): nome de exibição, cor primária com prévia e sugestões, contato da Secretaria, link https da Ouvidoria, aviso de privacidade, referência do ICMS Ecológico, logo e foto de capa (bucket `publico`, pasta `marca`). E2E: `#F2C94C` recusada ("contraste menor que 4.5:1"), Ouvidoria `http://` recusada, `#2B4A6B` + contato + Ouvidoria + aviso salvos; o visitante vê o rodapé em `rgb(43, 74, 107)`, o contato, o link da Ouvidoria em nova aba e o aviso em `/privacidade`. pgTAP: banco recusa contraste baixo e logo fora da pasta do município; gestor de A não altera B. |
| 2026-10-05 | 2.5 | E2E (visitante anônimo, 390x844): a capa mostra atividade publicada, eventos, atrativos e a categoria Hospedagem; rascunho e arquivado de atrativo, evento e prestador não aparecem em nenhuma lista e dão 404 por URL; detalhe do atrativo com foto otimizada (`/_next/image`, resposta AVIF/WebP), legenda como `alt`, horários e link do mapa; calendário e evento ligado ao atrativo; prestador com contatos autorizados. HTML de 8 páginas públicas sem o contato interno, o responsável, `/adesoes/` nem "comprovante"; link do comprovante sem sessão não leva a URL assinada. Integração `portal.test.ts` (6): pela Data API o anônimo recebe só o publicado (nem por id), `adesoes_prestador` dá 42501, `select *` em prestadores não traz coluna interna, embutir a adesão é negado. Axe (wcag2a/aa, 21a/aa) em 10 páginas públicas e no menu aberto: 0 violações críticas ou sérias. |
| 2026-10-05 | 2.6 | Layout municipal com `metadataBase` pelo host, título absoluto "Turismo em <município>" (sem o sufixo do hub), descrição, Open Graph (`pt_BR`, `site_name`, capa quando houver) e Twitter card; atrativo e evento com título, descrição (resumo do texto) e `og:image` da primeira foto com `og:image:alt`. E2E: Palmeirópolis e Peixe com títulos próprios; atrativo com `og:image` em `/storage/v1/object/public/publico/<municipio>/fotos/<uuid>.png`; rascunho não gera título. Imagens servidas otimizadas pelo `next/image` (resposta AVIF/WebP conferida no E2E). |
| 2026-10-05 | Fase 2 | `npm run verify` com código 0: typecheck, lint, Vitest 61/61 (11 arquivos), pgTAP 174/174 (4 arquivos), Playwright 28/28 (390x844, build de produção), build. pgTAP `004_portal` 47/47 (Storage entre municípios, visibilidade, FKs compostas); integração `storage` 6/6 e `portal` 6/6; unidade `upload` 6/6; E2E `portal.spec` 8/8 com axe em 10 páginas públicas (0 violações críticas ou sérias). Banco local zerado com `npx supabase db reset` no início da fase. |
| 2026-10-05 | 3.1 | Migration `relatorios_evidencias` aplicada por `npx supabase db reset`; tipos regenerados. `relatorio_completo` (gestor/admin) devolve os números da Fase 1 mais origem por cidade/UF, prestadores envolvidos e rede. pgTAP `005_evidencias`: origem agrupada (Gurupi 2 vouchers, 5 pessoas), prestador envolvido e participantes da rede, números da Fase 1 mantidos; operador e gestor de B recebem `sem_permissao`. E2E: `/admin/relatorios` com seletor de ano-base, seções de reservas, registros, atividades, origem (tabelas por UF e cidade), prestadores e lista de vouchers, sem nome nem contato no HTML. |
| 2026-10-05 | 3.2 | `/admin/relatorios/csv` (`text/csv`, anexo, `private, no-store`). E2E: CSV administrativo com 200, lista de vouchers e cidade pequena, sem nome e contato; impressão emulada esconde navegação, filtros e botões e mantém as seções. Unidade `relatorio-csv` (6): cabeçalho da lista sem nome/contato, BOM e `;`, neutralização de fórmulas. |
| 2026-10-05 | 3.3 | Versão "Para divulgação" na tela e no CSV. E2E com 4 registros voluntários que têm nome e contato reais: o CSV de divulgação não contém o nome, "Fulana", o contato nem o telefone, nem a cidade com 1 registro (somada em "Outras cidades"), nem linhas de voucher; a tela de divulgação não mostra a lista de vouchers. Unidade: códigos e nomes de prestadores ausentes, agregação mínima por cidade e UF. |
| 2026-10-05 | 3.4 | `/admin/evidencias` (por ano-base, arquivadas sob demanda), `/nova` e `/<id>` com fotos e anexos no bucket `interno`. E2E (390x844): gestor cria pela Visão geral ("Nova evidência"), vê "Incluída por [DEV] Gestor de Palmeirópolis" e data de inclusão separada da realização, envia PNG (imagem carregada pela URL assinada, 64 px) e PDF de lista de presença; data futura recusada no servidor. pgTAP: data futura recusada no banco, autoria automática e não forjável, FK composta e pasta do município, foto só JPEG/PNG, B não lê nem grava (tabela e Storage). Integração: gestor de Peixe não lê, não altera, não baixa nem assina URL do anexo de Palmeirópolis; operador não lê. |
| 2026-10-05 | 3.5 | Trigger `historico_evidencia`/`historico_arquivo_evidencia`. pgTAP: criação, edição (campos `descricao`, `responsavel`, antes e depois, autor "Gestora A", horário), salvar sem mudança não registra, inclusão/legenda/remoção de anexo e arquivamento registrados; ninguém insere nem apaga o histórico (42501). Integração pela API: edição gera `editada` com `autor_nome` "[DEV] Gestor de Palmeirópolis", `autor_id` da sessão e horário entre o antes e o depois. E2E: histórico na tela com "Alterou título", autor e "05/10/2026 às hh:mm". |
| 2026-10-05 | 3.6 | `/admin/relatorios/minuta?ano=` com identificação, apresentação (referência do ICMS configurável), atividades, indicadores com notas de leitura, evidências com fotos e anexos, seções 6 a 9 editáveis e campos em branco para nome, cargo, local e data e assinatura. Unidade `minuta` (11): sem assinatura simulada, aprovação/conselho, publicação oficial, pontuação/garantia nem "pesquisa concluída"; campos de assinatura sem valor; aviso antes da identificação. E2E: texto da página sem esses termos e sem o nome do gestor logado, 8 campos em branco, aviso "Não substitui a análise do órgão estadual competente", análise salva aparece na seção 8, impressão sem formulário e navegação. |
| 2026-10-05 | Fase 3 | `npm run verify` com código 0: typecheck, lint, Vitest 84/84 (14 arquivos; novos: `minuta` 11, `relatorio-csv` 6, integração `relatorios` 6), pgTAP 221/221 (5 arquivos; `005_evidencias` 47), Playwright 35/35 (390x844, build de produção; `relatorios.spec` 7, com axe sem violações críticas ou sérias em 6 telas do painel), build. Banco local zerado com `npx supabase db reset` no início da fase. |
| 2026-10-05 | 4.1 | `/admin/assessoria` (só admin; gestor é mandado para `/admin`, operador para o atendimento). E2E (390x844): lista os 7 municípios; "Desativar Arraias" → banco `ativo=false`, `arraias.localhost` responde 404 ao anônimo e o hub deixa de listar; "Ativar Arraias" volta; em Ananás (outro município, sem trocar de subdomínio) o nome de exibição salvo aparece no portal e depois é limpo; axe sem violações críticas ou sérias. |
| 2026-10-05 | 4.2 | Migration `administracao`: gestor grava vínculo só no próprio município, nunca o próprio, só `papel`/`ativo` alteráveis. pgTAP `006_administracao` (48): gestora não se promove, não promove outro, não cria vínculo em outro município, não move vínculo, não altera o próprio, não exclui; cria operador, troca papel e desativa no próprio. Integração `administracao` (pela API): 42501 ao criar vínculo em Peixe e ao se promover, 0 linhas ao promover outro. E2E: convite pela tela Equipe → conta com `invited_at` e sem senha; link do Mailpit (subdomínio do município) → `/conta/nova-senha` → convidado entra como operador e a senha passa a existir; reuso do link → link expirado; gestor troca o papel e desativa → convidado vê "Sem acesso"; rota adulterada (municipio_id de Peixe, campo `admin_assessoria`, action "Tornar administrador" reenviada com a sessão do gestor) → "sem permissão", nenhuma conta, vínculo ou admin criado. |
| 2026-10-05 | 4.3 | E2E (operador, 390x844): barra com só Atendimento, Emitir voucher e Mais; "Mais" sem Configurações, Conteúdo, Evidências, Equipe, Auditoria, Assessoria e Minuta; 18 páginas do painel (conteúdo, atividades, atrativos, eventos, prestadores, relatórios, minuta, evidências, configurações, equipe, auditoria, assessoria) levam ao Atendimento; CSV do relatório 403 e arquivo de evidência 404. |
| 2026-10-05 | 4.4 | `/admin/auditoria` com `auditoria_consultar`. pgTAP: gestora de A vê só A; filtros por pessoa, área e tipo com o nome do autor; campos alterados; período fora exclui; período invertido recusado; gestor de B e operador recebem `sem_permissao`; admin consulta todos. E2E: filtro área "Equipe e acessos" + "Inclusão" + pessoa mostra só inclusões do gestor; "Alteração" mostra "Campos: ativo"; período vazio explica o que fazer; gestor de Peixe pedindo Palmeirópolis pelo parâmetro vê só os registros de Peixe (contagem confere com o banco); admin em "Todos" vê o nome do município; axe ok. |
| 2026-10-05 | 4.5 | pgTAP: ninguém tem DELETE em `evidencias_arquivos`; gestora e operadora recebem `sem_permissao` na função; exclusão sem motivo recusada; com o arquivo ainda no Storage recusada; depois do Storage, o admin exclui e o histórico guarda autor, horário, tipo e motivo, sem a legenda. Integração (Storage local): gestor não apaga nem sobrescreve o arquivo em uso; admin apaga e a função registra. E2E: gestor só "Retira" (arquivo continua no Storage, URL dá 404 para ele); admin vê a seção LGPD com o arquivo retirado, motivo curto recusado, exclusão confirmada → download no Storage falha, linha some e o histórico mostra "Excluiu definitivamente um arquivo (lista de presença) a pedido do titular. Motivo: ...", "[DEV] Admin da assessoria" e o horário. |
| 2026-10-05 | Fase 4 | `npm run verify` com código 0: typecheck, lint, Vitest 89/89 (15 arquivos; novo: integração `administracao` 5), pgTAP 270/270 (6 arquivos; `006_administracao` 48), Playwright 41/41 (390x844, build de produção; `admin.spec` 6), build. Corrigido no caminho: a mensagem de sucesso da exclusão LGPD sumia junto com o item da lista. |
| 2026-10-05 | 5.1 | Migration `privacidade_anonimizacao`; tipos regenerados. pgTAP `007_privacidade` 14/14: função definer com `search_path=''`, sem `EXECUTE` para anon/authenticated, agendada no `pg_cron`; anonimiza os vouchers com 91 e 90 dias (A, prazo 90) e 31 dias (B, prazo 30), apaga nome e contato, mantém o de 89 dias; cidade, UF, pessoas, atendidas, estado e dia iguais nos 4; relatório completo do gestor idêntico antes e depois; auditoria sem nome nem contato; segunda execução = 0; prazo 60 alcança o de 89 dias. E2E `portal.spec` 8/8: prazo 3 recusado pelo servidor ("Use de 7 a 3650 dias."), 120 gravado no banco. |
| 2026-10-05 | 5.9 | Migration `lgpd_legenda_historico`; tipos regenerados. pgTAP `008_lgpd_legenda` 12/12: antes da exclusão 4 registros do histórico e a auditoria têm o nome da legenda; depois, 0 no histórico e 0 na auditoria; inclusão, troca de legenda, retirada e o registro antigo (sem `arquivo_id`) mostram "[removido a pedido do titular]"; registro da exclusão mantém autor, horário, tipo e motivo; autoria anterior mantida; legenda do outro arquivo intacta. Suíte pgTAP 296/296. E2E `admin.spec` 6/6: a linha "Retirou da evidência" mostra "[removido a pedido do titular]", a legenda não aparece para admin nem gestor, e o banco confirma 0 ocorrências no histórico e na auditoria. |
| 2026-10-05 | 5.8 | E2E novo em `admin.spec` (390x844): admin torna o gestor de Peixe administrador, clica em "Remover o acesso de administrador", a pessoa sai da lista e a confirmação "Acesso de administrador de [DEV] Gestor de Peixe removido." continua visível depois de 1,5 s; banco `admin_assessoria=false`. Rodado contra o código antigo: falha em `expect(confirmacao).toBeVisible()` (elemento não encontrado); com a correção, passa. |
| 2026-10-05 | 5.3 | E2E `acessibilidade.spec` 4/4 (390x844, build de produção). Axe sem violações críticas ou sérias em 57 páginas: 16 públicas (hub, portal, atrativos, atrativo, eventos, evento, prestadores, privacidade, reserva, reserva com erros na tela, comprovante, token inválido, login, recuperar senha, link expirado, 404), 30 do gestor (todas as rotas do painel, inclusive relatório de divulgação, minuta e nova senha), 5 do operador e 6 do admin (assessoria e município pela assessoria). Desempenho sem cache: maior conteúdo entre 784 e 1140 ms e JavaScript entre 145 e 252 KB (portal, reserva, comprovante, login, atendimento do operador). |
| 2026-10-05 | 5.6 | `docs/CUSTOS.md` com preços conferidos em 2026-10-05 nas páginas oficiais: Vercel (Hobby só não comercial; Pro US$ 20 com US$ 20 de crédito), Supabase (Free pausa após 1 semana e não tem backup; Pro US$ 25 com US$ 10 de crédito que cobre a Micro), Resend (Free 3.000/mês e 100/dia; Pro US$ 20), Tonic (`.to` US$ 50/ano) e API da Vercel (`.to` US$ 99,99/ano). Limites do SMTP padrão do Supabase conferidos na documentação. Total estimado: US$ 49,17 a 73,33 por mês, PITR opcional US$ 100. |
| 2026-10-05 | 5.7 | `docs/BACKUP.md` e restauração executada no ambiente local com `scripts/ensaio-restauracao.sh`: dump de papéis, estrutura e dados; exportação de 2 arquivos (1 por bucket) com SHA-256; desastre simulado (2 arquivos apagados pela API, `db reset --no-seed`: 0 municípios, 0 vouchers, 0 contas, 0 objetos); `data.sql` aplicado sem erro; "Restauração conferida: 2 arquivos no manifesto, 2 enviados de volta"; "IGUAL: 22 tabelas com mesma contagem e mesmo conteúdo (md5), inclusive objetos e configuração dos buckets" (7 municípios, 6 vouchers, 138 linhas de auditoria, 5 contas). Sequências de `auditoria` e `evidencias_historico` à frente do maior id. `privilegiado.test` passa com o script liberado como D8.5. |
| 2026-10-05 | 5.2 | `docs/PRIVACIDADE.md`: papéis (prefeitura controladora, assessoria operadora, provedores), finalidades, dados coletados de visitantes, equipe, evidências e prestadores, retenção (anonimização em 90 dias configurável, hash do IP 1 dia, cópias de segurança), quem acessa por papel, procedimentos de pedido do titular (nome e contato, foto ou lista de presença pela exclusão LGPD, saída da equipe) e texto padrão do aviso marcado "[REVISÃO JURÍDICA PENDENTE]". Cada afirmação confere com o que os testes provam (operador sem nome e contato, auditoria sem dados de visitante, divulgação agregada). Página `/privacidade` sem aviso configurado passou a informar o prazo do município (asserção no E2E `acessibilidade.spec`). |
| 2026-10-05 | 5.5 | `docs/MANUAL.md`: entrar, primeiro acesso e senha; barra do gestor e do operador; operador (conferir pela câmera ou código, tabela de avisos, cancelar, emitir sem celular); gestor (atividade com reserva e registro voluntário, horários e vagas, atrativos, eventos, prestadores, vouchers, relatórios com leitura correta dos números, evidências, minuta, equipe, configurações com o prazo de anonimização, auditoria) e problemas comuns. Rótulos de botões e menus conferidos no código (`grep` em `src/`), e os fluxos são os mesmos percorridos pelos E2E. |
| 2026-10-05 | 5.4 | README reescrito (ambiente local, endereços, contas de desenvolvimento, verificação, variáveis por ambiente, Supabase remoto sem `--include-seed`, Auth, Resend com `envio.turismo.to` e DNS na Vercel, Vercel, domínio e curinga, primeiro admin, operação) e `npm run env:local`. Validado em clone limpo do GitHub numa pasta temporária, com o Supabase local apagado antes (`supabase stop --no-backup`): `git clone` → `npm ci` → `npx playwright install chromium` → `npx supabase start` → `npm run env:local` → `npx supabase db reset` → `npm run verify` com código 0 (Vitest 89/89, pgTAP 296/296, Playwright 46/46, build) no commit `0056e6a`. As três rodadas anteriores acharam e corrigiram: fontes baixadas do Google no build, contraste do botão principal no hover e uma corrida no E2E da assessoria. |
| 2026-10-05 | Fase 5 | `npm run verify` com código 0 depois de `npx supabase db reset`: typecheck, lint, Vitest 89/89 (15 arquivos), pgTAP 296/296 (8 arquivos; novos `007_privacidade` 14 e `008_lgpd_legenda` 12), Playwright 46/46 (390x844, build de produção; novo `acessibilidade.spec` 4 com axe em 58 avaliações de páginas públicas e do painel, 0 violações críticas ou sérias, e orçamento de desempenho), build. Mesmo resultado no clone limpo. |
| 2026-10-05 | Merge da Fase 5 | Aprovado pelo Nero ("Pode publicar"). PR #6 sem conflito e com `npm run verify` em código 0, mesclado em `main` e branch `fase-5-qualidade` apagada. |
| 2026-10-06 | 6.1 (parcial, projeto de teste) | `supabase db push --db-url` aplicou as 10 migrations no "Turismo.TO Teste"; `seed.sql` e `seed.dev.sql` carregados pelo pooler IPv4: 7 municípios e 4 contas `[DEV]`. Produção ainda pendente (credenciais). |
| 2026-10-06 | Cron diário (pedido do `/goal`) | `vercel.json` + `/api/cron/manter-ativo`; `tests/integracao/cron.test.ts`: 401 sem segredo e com segredo errado, 200 `{ ok: true }` com o segredo (5/5); Vitest completo 94/94. |
| 2026-10-06 | E2E com alvo local ou preview | `tests/e2e/alvo.ts` e `ambienteE2E` (recusa o projeto de produção pelo ref); `npm run test:e2e` local: 46 passaram, 1 pulado (só no preview). |
| 2026-10-06 | 6.1 | `supabase db push --db-url` aplicou as 10 migrations em produção ("Turismo.TO"); só `seed.sql` pelo pooler `aws-0-sa-east-1`. Consulta: 7 municípios ativos, 0 usuários, 0 vouchers. `https://turismo.to` 200, `https://palmeiropolis.turismo.to` 200, `/admin` 307 para `/admin/login`, `naoexiste` 404. |
