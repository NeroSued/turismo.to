# Custos recorrentes

Preços consultados em **2026-10-05** nas páginas oficiais listadas em cada seção. Valores em dólar, sem impostos. Antes de contratar, confira de novo: os provedores mudam preços e limites sem aviso. Para converter para reais, use a cotação do dia e some o IOF do cartão internacional.

Regra deste documento: **plano gratuito não é tratado como suficiente para uso comercial.** Onde o provedor proíbe uso comercial ou não garante o serviço no plano gratuito, a estimativa usa o plano pago.

## Resumo mensal estimado

| Item | Plano | Mensal (US$) | Observação |
|:-|:-|-:|:-|
| Vercel (site) | Pro | 20,00 | Hobby é só para uso pessoal e não comercial |
| Supabase (banco, login, arquivos) | Pro, 1 projeto em Micro | 25,00 | Os US$ 10 de crédito de computação cobrem a instância Micro |
| Domínio `turismo.to` | Renovação anual | 4,17 a 8,33 | US$ 50/ano no registro oficial (Tonic); confira a renovação no Spaceship |
| E-mail transacional (Resend) | Free ou Pro | 0,00 a 20,00 | Ver abaixo |
| **Total** | | **49,17 a 73,33** | Sem cópias de segurança contínuas (PITR) |

Opcional: recuperação a qualquer momento no Supabase (PITR), **US$ 100/mês** para 7 dias. Ver [BACKUP.md](BACKUP.md).

Custos variáveis só aparecem se o uso passar das franquias abaixo, o que é improvável para sete portais municipais com reservas gratuitas.

## Vercel

Fonte: https://vercel.com/pricing (consultada em 2026-10-05).

- **Hobby: US$ 0.** A página diz: "Our Hobby plan is for personal, non-commercial use." Um portal mantido por uma assessoria para prefeituras é uso comercial, então **não use o Hobby em produção**.
- **Pro: US$ 20/mês** (preço base), com **US$ 20 de crédito** de uso incluído, **1 TB/mês** de transferência (depois US$ 0,15 por GB) e **1 milhão** de execuções de função por mês (depois a partir de US$ 0,60 por milhão). Confira na página o valor por membro adicional da equipe antes de convidar mais gente para o projeto.
- O domínio curinga (`*.turismo.to`) exige os nameservers da Vercel (ou delegação do `_acme-challenge`). Fonte: https://vercel.com/docs/domains/working-with-domains/add-a-domain (atualizada em 2026-09-16).

## Supabase

Fonte: https://supabase.com/pricing (consultada em 2026-10-05).

- **Free: US$ 0.** Projetos gratuitos **são pausados depois de 1 semana sem uso**, o banco tem 500 MB e **não há cópias de segurança**. Não serve para produção.
- **Pro: a partir de US$ 25/mês**, com **US$ 10/mês de crédito de computação** (cobre um projeto na instância Micro, de US$ 10), 8 GB de disco por projeto (depois US$ 0,125 por GB), 100 GB de arquivos (depois US$ 0,0213 por GB), 250 GB de transferência (depois US$ 0,09 por GB), 100 mil usuários ativos por mês e **cópias diárias guardadas por 7 dias**.
- Instâncias: Micro US$ 10/mês (1 GB de memória); Small US$ 15/mês (2 GB). Se o painel ficar lento em horário de pico, a Small acrescenta cerca de US$ 5/mês ao total, porque o crédito de US$ 10 continua valendo.
- PITR (recuperação a qualquer momento): US$ 100/mês para 7 dias.

## E-mail transacional: Resend

Decisão do Nero (2026-10-05): Resend, com um subdomínio de envio (`envio.turismo.to`), ligado ao Supabase Auth como SMTP personalizado. O sistema só manda convites para a equipe e e-mails de recuperação de senha; visitantes não recebem e-mail.

Fonte: https://resend.com/pricing (consultada em 2026-10-05).

- **Free: US$ 0**, 3.000 e-mails por mês, **no máximo 100 por dia**, 3 domínios, histórico de 30 dias.
- **Pro: US$ 20/mês** (50 mil e-mails) ou US$ 35/mês (100 mil), sem limite diário, 10 domínios.

O volume esperado cabe no Free, mas o limite diário de 100 pode travar o dia em que todas as equipes forem convidadas, e o plano gratuito não tem garantia de serviço. Por isso a estimativa vai de US$ 0 a US$ 20: comece no Free só se o Nero aceitar esse risco; caso contrário, contrate o Pro. O SMTP padrão do Supabase **não serve para produção**: só envia para endereços da equipe do projeto, com limite de 2 mensagens por hora e sem garantia de entrega (https://supabase.com/docs/guides/auth/auth-smtp, consultada em 2026-10-05).

## Domínio `turismo.to`

O domínio já está registrado pelo Nero, no Spaceship, e os nameservers já apontam para a Vercel (2026-10-05).

- Registro oficial do `.to` (Tonic), https://www.tonic.to/faq.htm (consultada em 2026-10-05): registro mínimo de 2 anos por US$ 100 (US$ 50 por ano) e **renovação mínima de 1 ano por US$ 50**.
- Se o domínio for transferido para a Vercel: **US$ 99,99/ano** para registro, renovação ou transferência (API de preços da Vercel, consultada em 2026-10-05). Não é necessário transferir: os nameservers já apontam para a Vercel.
- Registrador atual: Spaceship. O preço de renovação dele não foi conferido aqui (a página do Spaceship recusou a consulta automática em 2026-10-05; veja na conta do Nero); a faixa da tabela vai do preço do registro oficial (US$ 50/ano) ao da Vercel (US$ 99,99/ano).

Anote a data de vencimento do domínio e ative a renovação automática. Domínio vencido derruba todos os portais e os e-mails de uma vez.

## O que não custa nada a mais

- GitHub (repositório privado de um usuário): já em uso.
- Mapas: a página do atrativo usa link para o OpenStreetMap, sem chave nem cobrança.
- Imagens otimizadas pelo `next/image` entram na franquia da Vercel Pro.
