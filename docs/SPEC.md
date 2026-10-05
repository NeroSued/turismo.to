# Especificação: Turismo.TO

Este documento é a fonte de requisitos do projeto. O plano de execução está em `docs/PLANO.md` e as regras de trabalho em `CLAUDE.md`.

Você é responsável por desenvolver um portal de turismo para pequenos municípios do Tocantins. Implemente uma primeira versão funcional, simples de operar e preparada para hospedagem na Vercel, usando Supabase para banco de dados, autenticação e arquivos.

Não entregue apenas um planejamento ou telas demonstrativas. Desenvolva os fluxos completos, com persistência, permissões e testes das regras críticas.

## 1. Contexto e objetivo

Prestamos assessoria aos municípios de:

- Palmeirópolis: palmeiropolis
- São Salvador do Tocantins: saosalvador
- Jaú do Tocantins: jaudotocantins
- Paranã: parana
- Arraias: arraias
- Peixe: peixe
- Ananás: ananas

São municípios com equipes pequenas e turismo predominantemente gratuito.

O portal deve divulgar atrativos e eventos, organizar uma rede de prestadores e permitir a emissão e utilização de vouchers turísticos gratuitos.

Também deve facilitar a documentação das ações para a avaliação do ICMS Ecológico do Tocantins. O sistema não garante pontuação nem substitui a análise estadual.

A referência fornecida é o item 6.1.4 da cartilha do ICMS Ecológico, que contempla implantação de voucher, criação da rede de prestadores e estudos sobre ordenamento turístico. Trate essa referência como configurável, pois normas e numerações podem mudar.

## 2. Tecnologia e arquitetura

Utilize:

- Next.js com App Router e TypeScript.
- Tailwind CSS e componentes acessíveis, preferencialmente shadcn/ui.
- Supabase Postgres, Auth e Storage.
- Vercel para hospedagem.
- Validação de dados no servidor, preferencialmente com Zod.

Consulte a documentação oficial atual antes de implementar integrações. Use versões estáveis compatíveis e mantenha o arquivo de dependências travadas.

Construa uma única aplicação para vários municípios, com dados e permissões separados.

O domínio pretendido é turismo.to, mas a aplicação deve funcionar com domínio configurável, sem depender de sua aquisição.

Endereços pretendidos:

- turismo.to: página com os municípios participantes.
- palmeiropolis.turismo.to: portal público municipal.
- palmeiropolis.turismo.to/admin: painel municipal.
- Equivalente para os demais municípios.

Ofereça uma forma documentada de acessar cada município no ambiente local e nos previews da Vercel, sem depender de DNS público. Restrinja esse mecanismo aos ambientes apropriados.

O subdomínio identifica o portal; ele não substitui a verificação de autorização.

## 3. Perfis e segurança

Crie três perfis:

- Administrador da assessoria: gerencia municípios, usuários e configurações; acessa os dados dos municípios.
- Gestor municipal: gerencia conteúdo, prestadores, vouchers e relatórios dos municípios aos quais está vinculado.
- Operador municipal: emite vouchers presencialmente e confirma participações, com acesso apenas às informações necessárias.

Utilize contas individuais com e-mail e senha, recuperação de acesso e convite ou provisionamento administrativo. Não permita cadastro público de gestores nem senhas compartilhadas por prefeitura.

Visitantes não precisam criar conta.

Implemente o isolamento no banco com RLS e permissões mínimas, além das verificações no servidor. Proteja também arquivos, relatórios, consultas agregadas e funções.

Requisitos essenciais:

- Vínculos e perfis administrativos não podem ser alterados pelo próprio usuário.
- Não use metadados editáveis pelo usuário para autorizar acessos.
- Valide município, usuário e recurso em cada operação.
- Impeça relacionamentos entre registros de municípios diferentes.
- Nunca exponha chaves secretas ou service_role no navegador.
- Não use credenciais privilegiadas como solução geral para contornar RLS.
- Se uma operação pública precisar de privilégios elevados, mantenha-a restrita ao servidor, com validação explícita, proteção contra abuso e resposta mínima.
- Separe dados públicos de informações internas e pessoais.
- Não compartilhe cache de páginas autenticadas entre usuários ou municípios.
- Registre alterações relevantes e quem realizou cada ação.

## 4. Portal público e cadastros

Crie uma interface em português do Brasil, rápida e adequada ao celular, com:

- Apresentação do município.
- Atrativos turísticos.
- Calendário de eventos.
- Rede de prestadores.
- Atividades disponíveis para voucher.
- Contato da Secretaria de Turismo.

Atrativos devem ter nome, categoria, descrição, fotos, endereço ou coordenadas, horários, contato, condições de acesso, acessibilidade e orientações ambientais.

Eventos devem ter período, local, descrição, organizador e vínculo opcional com um atrativo.

Prestadores devem ter nome público, categoria, serviços, contatos autorizados, localização, fotos e situação de participação na rede. Permita registrar adesão, data, responsável e comprovante opcional.

Diferencie cadastro em elaboração, conteúdo publicado e conteúdo arquivado. Mantenha documentos de adesão e contatos internos privados.

Nesta versão, os gestores cadastram os prestadores. Não crie painel próprio para cada empresa.

Permita configurar um link para a Ouvidoria oficial do município. Não desenvolva um sistema completo de denúncias agora.

## 5. Voucher turístico gratuito

O voucher deve ser um comprovante de reserva ou registro de visitação. Não implemente pagamento, taxa turística ou venda de ingressos.

Diferencie dois usos:

- Registro voluntário: para atrativos de acesso livre. Informe claramente que o cadastro não condiciona a entrada.
- Reserva gratuita: para passeios, visitas guiadas e atividades organizadas com data, horário e, quando necessário, limite de participantes.

Cadastrar um atrativo não deve ativar automaticamente uma exigência de voucher. A prefeitura seleciona quais atividades participarão e descreve suas condições.

Fluxo do visitante:

1. Escolher atividade e data/horário.
2. Informar cidade/UF de origem e quantidade de participantes.
3. Informar nome do responsável ou contato apenas quando necessário à atividade.
4. Receber voucher com código, QR Code, município, atividade, horário, quantidade de pessoas e indicação de gratuidade.
5. Salvar ou imprimir o comprovante.

Não exija CPF, documento, endereço completo ou identificação individual de crianças no fluxo padrão.

Permita emissão assistida pelo operador para pessoas sem celular ou internet. Não prometa funcionamento offline completo nesta versão.

Fluxo de atendimento:

- Operador autenticado lê o QR Code pela câmera ou digita o código.
- Confere a atividade e registra a quantidade efetivamente atendida.
- O sistema registra data, horário e operador.
- Uma confirmação repetida não gera nova contagem.
- Impede utilização de voucher cancelado ou de outro município.

Use estados coerentes para emitido/reservado, utilizado, cancelado e expirado. Defina transições e regras claras.

Reservas com limite devem controlar vagas por pessoas, não por quantidade de vouchers. A emissão e a liberação de vagas devem ser transacionais e protegidas contra concorrência e repetição de requisições.

Use identificadores imprevisíveis. QR Codes não devem carregar dados pessoais nem permitir confirmação de presença sem autenticação. Eventuais links de consulta ou cancelamento do visitante precisam de tokens apropriados e proteção contra enumeração.

Não coloque emissão de e-mail, integração paga com WhatsApp ou conta do visitante como dependências para concluir o fluxo.

## 6. Relatórios e comprovações

Crie relatórios por município, período e ano-base, distinguindo:

- Vouchers emitidos.
- Vouchers utilizados.
- Cancelamentos.
- Participações confirmadas.
- Registros voluntários/autodeclarados.
- Origem dos participantes.
- Atividades e prestadores envolvidos.

Não apresente reservas como visitas realizadas, nem participações como turistas únicos. Registros voluntários representam adesões ao sistema, não uma contagem completa do fluxo turístico.

Ofereça CSV e uma versão bem formatada para impressão/salvar em PDF.

Inclua uma área simples de evidências com:

- Tipo da ação.
- Descrição.
- Data de realização.
- Responsável.
- Fotos e legendas.
- Listas de presença, atas e outros anexos.
- Vínculo com município e ano-base.

Diferencie a data informada da atividade da data automática de inclusão no sistema. Preserve autoria e histórico de alterações.

Gere uma minuta de relatório de implantação com atividades, indicadores, evidências e espaço para identificação e assinatura do gestor. Não simule assinatura, publicação oficial, aprovação de conselho ou reconhecimento de pontuação.

Mantenha os relatórios administrativos privados por padrão. Exportações para divulgação devem omitir dados pessoais.

Os dados podem subsidiar estudos, mas não devem ser apresentados automaticamente como pesquisa técnica concluída. Deixe espaço para o responsável adicionar metodologia, limitações, análise e recomendações.

## 7. Experiência de uso e privacidade

O painel deve ter navegação simples:

Visão geral, Atrativos, Eventos e atividades, Prestadores, Vouchers, Relatórios, Evidências e Configurações.

Priorize formulários curtos, mensagens claras, bons estados vazios, acessibilidade por teclado, contraste adequado e botões fáceis de usar no celular. O uso principal, tanto do público quanto de gestores e operadores, é pelo celular.

Use uma identidade visual sóbria ligada à natureza e à cultura do Tocantins, com personalização municipal de nome, logotipo e cores. Não invente brasões, fotos, atrativos ou informações oficiais.

Colete apenas dados necessários. Inclua aviso de privacidade configurável e documente finalidade, retenção, acesso e procedimento de exclusão ou anonimização. Não use um checkbox genérico de consentimento como substituto dessa definição.

Fotos públicas e documentos internos devem ter regras de armazenamento distintas. Valide tamanho e tipo dos arquivos.

Armazene horários de forma consistente e exiba-os no fuso America/Araguaina.

## 8. Escopo e entregas

Mantenha o MVP econômico. Não implemente aplicativo nativo, marketplace, pagamentos, chatbot, programa de pontos ou integrações com sistemas estaduais.

Entregue:

- Aplicação funcional.
- Modelo de dados e migrations versionadas.
- Políticas RLS e permissões de arquivos.
- Cadastro inicial dos sete municípios.
- Procedimento seguro para criar o primeiro administrador.
- Arquivo de exemplo das variáveis de ambiente, sem segredos.
- Instruções de instalação, configuração do Supabase, domínio e implantação na Vercel.
- Orientações de backup e recuperação adequadas aos serviços escolhidos.
- Manual curto para gestores e operadores.

Dados fictícios devem existir apenas em ambiente de desenvolvimento, claramente identificados. Não crie vouchers, visitas ou evidências fictícias em produção.

Documente custos e dependências recorrentes. Não presuma que planos gratuitos sejam adequados ao uso comercial da assessoria.

## 9. Execução e validação

Primeiro, inspecione a pasta e preserve o trabalho existente. Tome decisões técnicas rotineiras de forma autônoma.

Priorize uma primeira entrega completa de ponta a ponta: criar atividade, publicar, emitir voucher, confirmar participação e gerar relatório. Depois conclua os demais módulos.

Peça informações apenas quando uma decisão ou credencial realmente bloquear o trabalho. Se faltar acesso à Vercel ou ao Supabase, avance no código, migrations e testes locais, indicando precisamente a configuração pendente. Nunca apresente integração simulada como integração concluída.

Verifique especialmente:

- Isolamento entre dois municípios no banco, APIs, arquivos e relatórios.
- Impossibilidade de visitante acessar dados privados ou se tornar gestor.
- Emissão e confirmação real de voucher.
- Rejeição de confirmação repetida, voucher cancelado e acesso de outro município.
- Limite de vagas com solicitações simultâneas.
- Coerência entre participantes reservados, atendidos e relatórios.
- Funcionamento em celular, ambiente local e preview.

Execute as verificações de tipos, qualidade de código, build e testes críticos disponíveis. Ao finalizar cada fase, informe o que funciona, o que foi testado e quais etapas externas ainda faltam.
