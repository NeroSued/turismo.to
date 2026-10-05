# Turismo.TO

Portal de turismo para sete municípios do Tocantins. Uma única aplicação Next.js hospedada na Vercel, com Supabase (Postgres, Auth e Storage) e dados separados por município.

- Especificação completa (manda em caso de dúvida): `docs/SPEC.md`
- Plano de execução, estado atual, decisões e bloqueios: `docs/PLANO.md`
- Repositório: https://github.com/NeroSued/turismo.to
- Supabase: projeto "Turismo.TO", ref `kytbiyiltfpyvwuumfds`
- Referência visual: canvas "Turismo.TO Mobile" em https://claude.ai/artifact/2oeMYd6RhxTDvMbnLUWm3u (telas Hub, Portal municipal, Reserva gratuita, Voucher emitido, Operador e Gestor). Ao implementar uma dessas telas, leia o artboard correspondente antes.

Idioma: interface, mensagens de commit, documentação e respostas em português do Brasil.

## Antes de qualquer trabalho

1. Leia `docs/PLANO.md` e identifique a fase ativa (a primeira com itens abertos).
2. Trabalhe só nessa fase. Adiante algo de fase futura apenas quando for indispensável para a atual funcionar, e registre isso em "Decisões".
3. Se o plano e a SPEC divergirem, siga a SPEC e registre a divergência em "Decisões".

## Protocolo para trabalhar com /goal

O avaliador do `/goal` não lê arquivos nem roda comandos: ele só enxerga o que aparece na conversa. Por isso:

1. Trabalhe item por item, na ordem do plano, salvo dependência técnica.
2. Marque `[x]` em um item somente depois de verificar que funciona (teste, comando ou inspeção real). Nunca marque algo simulado como concluído.
3. A cada item concluído: adicione uma linha em "Registro" no PLANO (data, item, como foi verificado) e faça um commit.
4. Nunca enfraqueça, pule ou apague testes para fazer uma verificação passar. Se um critério estiver errado, registre em "Decisões" e explique.
5. Ao final de cada turno, escreva uma linha de status: `Fase N · itens X/Y · próximo: ...`.
6. Ao fechar a fase: rode `npm run verify`, mostre a saída final na conversa e cole a lista "Pronto quando" da fase com o resultado de cada critério.
7. Bloqueio (credencial, decisão do Nero, ferramenta ausente): registre em "Bloqueios" no PLANO, avance nos itens que não dependem dele e, se nada mais puder ser feito, escreva `BLOQUEADO:` seguido do motivo exato e do que o Nero precisa fazer.
8. Tome decisões técnicas rotineiras sozinho e registre as relevantes em "Decisões". Pergunte só quando a decisão for irreversível ou depender de informação que só o Nero tem.

## Stack

- Next.js (App Router) com TypeScript em modo strict. Use as versões estáveis atuais; confira a documentação oficial antes de integrar. No Next 16 ou posterior o arquivo de middleware se chama `proxy.ts`.
- Tailwind CSS, shadcn/ui, lucide-react para ícones.
- Zod para validar toda entrada no servidor.
- Supabase com `@supabase/ssr` (cliente de navegador e de servidor por cookies).
- Gerenciador de pacotes: npm, com `package-lock.json` versionado.
- Testes: Vitest (unidade e integração contra o Supabase local), pgTAP via `supabase test db` (RLS, funções e Storage), Playwright com viewport de celular 390x844.

## Comandos

```
npm run dev            # http://localhost:3000 (hub) e http://palmeiropolis.localhost:3000
npm run typecheck      # tsc --noEmit
npm run lint
npm run test           # Vitest
npm run test:db        # pgTAP
npm run test:e2e       # Playwright
npm run build
npm run verify         # todos os anteriores, exceto dev; precisa sair com código 0
npx supabase start | stop | db reset
npx supabase migration new <nome>
npx supabase gen types typescript --local > src/lib/database.types.ts
```

Se algum desses scripts ainda não existir, criá-lo faz parte da Fase 0.

## Identificação do município

- Host `<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>` identifica o município. Host igual ao domínio raiz mostra o hub com os municípios.
- Local: subdomínios `*.localhost` funcionam sem configurar DNS.
- Preview da Vercel: `?municipio=<slug>` grava um cookie de seleção, aceito apenas quando `ALLOW_TENANT_OVERRIDE=true`. Essa variável existe só nos ambientes Development e Preview. Em produção o parâmetro é ignorado.
- Slug inexistente ou município inativo: 404.
- O município do host nunca autoriza nada. Toda operação no servidor e no banco confere o vínculo do usuário com o município do recurso.

## Regras de segurança (inegociáveis)

- RLS ativa em todas as tabelas do schema `public`, cada uma com políticas explícitas e teste pgTAP.
- Autorização lida das tabelas `perfis` e `vinculos` por funções SQL `security definer` com `set search_path = ''`. Nunca use `user_metadata` nem `app_metadata` para autorizar.
- Ninguém altera o próprio perfil administrativo nem os próprios vínculos.
- Relacionamentos entre tabelas de município usam chave estrangeira composta `(municipio_id, id)`, impedindo misturar registros de municípios diferentes.
- A chave `service_role` fica apenas em `src/lib/supabase/privilegiado.ts`, que começa com `import 'server-only'`. Só pode ser usada nas operações listadas em "Operações privilegiadas" no PLANO. Um teste falha se outro arquivo importar esse módulo.
- Variáveis `NEXT_PUBLIC_*` nunca contêm segredo. Nenhum arquivo `.env*` é versionado, exceto `.env.example`.
- Operações públicas: validação Zod, limite de requisições, chave de idempotência e resposta mínima.
- Páginas e rotas autenticadas são dinâmicas, com `Cache-Control: private, no-store`. Nada autenticado entra em cache compartilhado.
- Alterações relevantes ficam na tabela `auditoria` (quem, quando, o quê), preenchida por trigger.
- Uploads: valide tipo e tamanho no servidor e na configuração do bucket. Bucket `publico` para fotos publicadas; bucket `interno` (privado, URLs assinadas de curta duração) para comprovantes, listas de presença, atas e anexos.
- Senhas e chaves nunca aparecem em commits, logs, mensagens de erro ou na conversa.

## Banco de dados

- Toda mudança de schema é uma migration versionada em `supabase/migrations`. Nunca altere o banco remoto à mão.
- Horários em `timestamptz`. Horários digitados pelo gestor são interpretados no fuso America/Araguaina. Exiba sempre pelo helper único `src/lib/datas.ts`, que formata em pt-BR no fuso America/Araguaina.
- Identificadores: UUID. Códigos públicos gerados no banco com bytes aleatórios.
- `supabase/seed.sql` contém apenas os sete municípios reais e vale para qualquer ambiente.
- `supabase/seed.dev.sql` contém dados fictícios marcados com `[DEV]` no nome e roda só localmente. Nunca aplique no projeto remoto.
- Depois de mudar o schema, regenere `src/lib/database.types.ts`.

## Interface

- Celular primeiro: projete em 390px de largura e só depois amplie. Gestores e operadores usam o painel pelo celular.
- Alvos de toque com no mínimo 44px; botões principais com 52 a 56px de altura.
- Campos de formulário com fonte de 16px ou mais (evita zoom automático no iOS) e `<label>` visível.
- Foco visível em todos os elementos interativos: contorno dourado `#C99A3B` de 3px.
- Cores:
  - fundo `#EEF0EA`, superfície `#FFFFFF`, borda `#D5DAD0`
  - texto `#16211B`, texto secundário `#4F5A52`
  - primária municipal padrão `#1F4D3A` (configurável por município; recuse cores com contraste menor que 4.5:1 sobre branco)
  - verde suave `#DCE7DF`; dourado `#C99A3B`; dourado suave `#F3E6C8` com texto `#6B4A0E`
  - erro `#A3402B` com fundo `#F6E1DB`
- Fontes via `next/font`: Atkinson Hyperlegible para texto, Bricolage Grotesque para títulos.
- Evite gradientes decorativos, emoji, cards com borda colorida lateral e textos genéricos de marketing.
- Estados vazios explicam o que fazer a seguir. Mensagens de erro dizem o que aconteceu e como resolver.
- Painel: Visão geral, Atrativos, Eventos e atividades, Prestadores, Vouchers, Relatórios, Evidências e Configurações. No celular, barra inferior com Início, Conteúdo, Vouchers, Relatórios e Mais. O operador vê apenas atendimento e emissão de vouchers.

## Conteúdo

- Não invente atrativos, fotos, brasões, contatos ou informações oficiais. Use placeholders entre colchetes e estados vazios.
- Relatórios nunca chamam reservas de visitas, nem participações de turistas únicos. Registros voluntários são adesões ao sistema, não contagem do fluxo turístico.
- O sistema não promete pontuação no ICMS Ecológico. A referência à cartilha (padrão "item 6.1.4") é configurável.

## Git

- Uma branch por fase: `fase-0-fundacao`, `fase-1-voucher` e assim por diante, criada a partir de `main`.
- Commits pequenos, em português: `tipo(escopo): descrição` (`feat`, `fix`, `test`, `docs`, `chore`, `refactor`).
- Ao concluir a fase: push da branch e abertura de PR para `main` com o resumo da fase e os critérios verificados.
- Ao concluir a fase, com npm run verify em código 0 e todos os critérios da fase atendidos, faça o merge do PR em main você mesmo e apague a branch. Se o PR tiver conflito ou algum critério falhar, não faça merge: registre em Bloqueios e avise o Nero. A partir da Fase 6, quando a Vercel estiver ligada ao repositório, merge em main publica em produção e só acontece com aprovação explícita do Nero.

## Ambiente

- GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (no Git Bash: `"/c/Program Files/GitHub CLI/gh.exe"`), versão 2.102.0, autenticado como NeroSued. Pode não estar no PATH de terminais abertos antes da instalação.
- Docker Desktop instalado por usuário em `%LOCALAPPDATA%\Programs\DockerDesktop`.
