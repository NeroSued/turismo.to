# Privacidade e proteção de dados

Este documento descreve como o Turismo.TO trata dados pessoais, para a assessoria e para as prefeituras. Ele reflete o que o sistema faz hoje (verificado por testes automáticos) e **não substitui a análise jurídica de cada prefeitura**. O texto padrão do aviso, no fim, precisa dessa revisão antes de ser publicado.

## Quem é quem

- **Controladora:** a prefeitura de cada município. Ela decide oferecer as reservas, o que pedir aos visitantes e por quanto tempo guardar.
- **Operadora:** a assessoria que mantém o sistema, nos termos do contrato com cada prefeitura.
- **Provedores:** Supabase (banco, contas e arquivos), Vercel (hospedagem do site) e Resend (e-mails de convite e de recuperação de senha da equipe). Os contratos e a localização dos dados desses provedores devem constar do contrato da assessoria com a prefeitura.

## Finalidades

1. Organizar atividades gratuitas com vagas limitadas (reserva de vagas e conferência na entrada).
2. Registrar voluntariamente visitas a atrativos de acesso livre.
3. Produzir estatísticas agregadas de turismo do município (origem por cidade e UF, quantidades) e reunir evidências das ações da Secretaria de Turismo.
4. Dar acesso ao painel apenas a quem trabalha para a prefeitura ou para a assessoria.

O sistema não faz publicidade, não vende nem compartilha dados com terceiros e não cria perfil de visitante. Os relatórios contam reservas e participações; não chamam reservas de visitas nem participações de turistas únicos, e registros voluntários são adesões ao sistema, não contagem do fluxo turístico.

## Dados coletados

### Visitantes (portal público)

| Dado | Quando | Por quê |
|:-|:-|:-|
| Cidade e UF de origem | Sempre | Estatística de origem |
| Quantidade de pessoas | Sempre | Vagas e estatística |
| Nome do responsável | Só se a atividade exigir | Organização de grupo e contato no dia |
| Telefone ou e-mail | Só se a atividade exigir | Avisar de mudança ou cancelamento |
| Hash do endereço IP | Em cada reserva ou consulta | Limitar abusos (até 10 reservas por IP a cada 10 minutos). O IP nunca é guardado, só o hash SHA-256, e a contagem é apagada em 1 dia |

Não são pedidos CPF, documento, endereço, data de nascimento nem criação de conta. Não há cookies de rastreamento; o portal só usa cookies de sessão do painel e, em ambiente de teste, um cookie de escolha do município.

O visitante recebe um link com um código secreto para consultar e cancelar a reserva. O banco guarda só o hash desse código.

### Equipe (painel)

Nome, e-mail, papel (gestor ou operador) e município; horário de entrada; registro do que cada pessoa alterou (auditoria). Senhas são guardadas pelo Supabase Auth só como hash; ninguém da assessoria as vê.

### Evidências e prestadores

- Evidências podem ter fotos e listas de presença com nomes e assinaturas de participantes. Ficam no bucket privado `interno`, abertas só por links temporários de 60 segundos para gestores do município e para a assessoria.
- Fotos de atrativos, eventos, prestadores e atividades, e a capa e o logo do município, são públicas. Antes de publicar, o servidor apaga os metadados da câmera (EXIF, inclusive a localização GPS, modelo do aparelho e nome do autor gravado pela câmera) e reduz a imagem para no máximo 2000 pixels. O arquivo original fica num bucket privado (`originais`) só durante esse tratamento e é apagado em seguida.
- Adesões de prestadores guardam responsável, contato interno e comprovante, também privados. No portal aparece só o que o prestador autorizou divulgar.

## Retenção

| Dado | Prazo |
|:-|:-|
| Nome e contato do visitante | Apagados automaticamente **90 dias depois da data da atividade** (prazo configurável por município em Configurações, de 7 a 3.650 dias). A rotina roda todo dia às 00:15 (horário de Araguaína). |
| Cidade, UF, quantidades e situação do voucher | Mantidos para as estatísticas, sem dado pessoal depois da anonimização |
| Hash do IP (limite de requisições) | 1 dia |
| Evidências e anexos | Enquanto a prefeitura precisar comprovar as ações; arquivar tira da tela, não apaga |
| Contas da equipe | Enquanto houver vínculo; vínculo desativado tira o acesso |
| Auditoria | Mantida; não guarda nome nem contato de visitantes (testado) |
| Cópias de segurança | Conforme [BACKUP.md](BACKUP.md): 7 dias no Supabase e as cópias próprias da assessoria (4 semanais e 12 mensais). Dados anonimizados no banco continuam nas cópias antigas até elas expirarem |

## Quem acessa

| Quem | O que vê |
|:-|:-|
| Visitante | Só o próprio comprovante, pelo link secreto |
| Operador do município | Na conferência: código, atividade, horário, pessoas, cidade e UF. **Não vê nome nem contato** |
| Gestor do município | Vouchers do próprio município, inclusive nome e contato enquanto não anonimizados; evidências, relatórios e auditoria do próprio município |
| Assessoria (admin) | Todos os municípios, para suporte e manutenção |
| Outro município | Nada. Cada consulta confere o vínculo da pessoa com o município do dado, no banco (RLS), e não pelo endereço do site |

Os relatórios para divulgação têm só números agregados; cidades e UFs com menos de 3 registros entram em "Outras", para ninguém ser identificado pela origem.

## Pedidos do titular

O canal é a Ouvidoria ou a Secretaria de Turismo do município (contatos no rodapé do portal). A assessoria apoia a prefeitura no atendimento.

### Visitante pede para apagar nome e contato antes do prazo

1. O gestor localiza o voucher pelo código (o visitante tem o comprovante) ou pela data e atividade.
2. Hoje não há botão para isso no painel: a assessoria apaga nome e contato daquele voucher no banco, mantendo cidade, UF e quantidades, e registra o pedido (data, canal e quem atendeu) fora do sistema. Se o pedido for frequente, vale incluir um botão no painel.
3. Responda ao titular pelo mesmo canal.

O visitante também pode cancelar a própria reserva pelo link do comprovante.

### Pessoa aparece numa foto ou lista de presença e pede a exclusão

1. O gestor abre a evidência e usa **Retirar**: o arquivo sai da tela e da minuta na hora.
2. A assessoria (admin) abre a mesma evidência, seção **Exclusão a pedido do titular (LGPD)**, escolhe o arquivo, escreve o motivo (sem dados pessoais) e confirma.
3. O sistema apaga o arquivo do Storage sem guardar cópia, apaga o registro e substitui a legenda por "[removido a pedido do titular]" em todo o histórico e na auditoria. Fica registrado quem excluiu, quando, o tipo do arquivo e o motivo.
4. O arquivo pode continuar nas cópias de segurança até elas expirarem (ver acima). Se o titular pedir, a assessoria registra o pedido para não restaurar aquele arquivo numa eventual restauração.

### Integrante da equipe deixa a prefeitura

O gestor desativa o vínculo em **Equipe**. A pessoa perde o acesso na próxima página que abrir. O registro do que ela fez continua na auditoria.

## Segurança, em resumo

- Regras de acesso no próprio banco (RLS) em todas as tabelas, testadas automaticamente a cada mudança.
- A chave de administração do banco só é usada no servidor, em operações listadas no [PLANO](PLANO.md) (D8).
- Páginas do painel nunca ficam em cache compartilhado.
- Uploads conferidos por tipo real do arquivo e tamanho, no servidor e no Storage.
- Toda alteração relevante fica na auditoria, com autor e horário.

## Texto padrão do aviso de privacidade

> **[REVISÃO JURÍDICA PENDENTE]** Texto-base para a prefeitura. Precisa ser revisado pela procuradoria ou assessoria jurídica do município antes de publicar. Substitua os campos entre colchetes. Depois de revisado, o gestor cola o texto em Painel → Mais → Configurações → Aviso de privacidade.

```text
Aviso de privacidade do portal de turismo de [Nome do município]

Quem trata os seus dados
A Prefeitura Municipal de [Nome do município], por meio da [Secretaria de Turismo], CNPJ [00.000.000/0000-00], [endereço], é responsável pelos dados coletados neste portal. Encarregado(a) pelo tratamento de dados pessoais: [nome ou cargo], [e-mail ou telefone].

Para que usamos
Para organizar as atividades gratuitas com vagas limitadas, conferir a sua reserva na entrada, registrar visitas que você informar voluntariamente e produzir estatísticas de turismo do município. Não usamos os seus dados para publicidade e não os vendemos nem compartilhamos com terceiros, exceto os serviços de tecnologia que mantêm o portal funcionando, sob contrato.

O que coletamos
Sempre: cidade e estado de origem e a quantidade de pessoas.
Só quando a atividade exige: o nome do responsável e um telefone ou e-mail, para organizar o grupo e avisar de mudanças.
Para evitar abusos, registramos de forma cifrada o endereço de internet usado na reserva, por até 1 dia.
Não pedimos CPF, documento, endereço nem criação de conta.

Por quanto tempo guardamos
O nome e o contato são apagados automaticamente [90] dias depois da data da atividade. Depois disso, ficam apenas cidade, estado e quantidades, sem identificar ninguém, para as estatísticas do município.

Base legal
[A definir pela assessoria jurídica do município, por exemplo: execução de políticas públicas de turismo (art. 7º, III, e art. 23 da Lei 13.709/2018).]

Quem tem acesso
Apenas servidores e colaboradores da [Secretaria de Turismo] que organizam as atividades e a equipe técnica que mantém o portal. Quem confere a reserva na entrada vê só o código, a atividade, o horário, a quantidade de pessoas e a origem.

Seus direitos
Você pode pedir a confirmação, o acesso, a correção ou a exclusão dos seus dados, e cancelar a sua reserva pelo link do comprovante. Para isso, fale com a [Ouvidoria / Secretaria de Turismo]: [contato]. Respondemos em até [15] dias.

Fotos e listas de presença
Atividades e eventos podem ser fotografados e ter lista de presença, como comprovação das ações do município. Se você aparecer e quiser a exclusão, peça pelo mesmo canal.

Última atualização: [data].
```
