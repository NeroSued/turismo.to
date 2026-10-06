# Manual do painel

Para gestores e operadores das Secretarias de Turismo. O painel funciona no celular; não é preciso instalar nada.

## Entrar

1. Abra o endereço do seu município seguido de `/admin`. Exemplo: `palmeiropolis.turismo.to/admin`.
2. Digite o e-mail e a senha e toque em **Entrar**.

**Primeiro acesso:** você recebe um e-mail "Convite para o painel Turismo.TO". Toque no link e crie a sua senha. O link vale uma vez; se expirar, peça um novo convite ao gestor.

**Esqueceu a senha:** na tela de entrada, toque em **Esqueci minha senha**, informe o e-mail e siga o link que chegar. Ninguém da prefeitura ou da assessoria sabe a sua senha.

**"Sem acesso a este painel":** a sua conta não tem vínculo com este município, ou o acesso foi desativado. Fale com o gestor.

**Trabalha em mais de um município:** toque no nome do município, no alto do painel, e escolha outro. Você continua conectado. Quem tem acesso a um município só não vê essa opção. **Sair** desconecta de todos os municípios.

## Barra inferior

- **Gestor:** Início, Conteúdo, Vouchers, Relatórios e Mais.
- **Operador:** Atendimento, Emitir voucher e Mais.

Em **Mais** ficam Configurações, Equipe, Evidências, Auditoria, a minuta do relatório e o botão para sair.

---

## Operador

### Conferir um voucher na entrada

1. Toque em **Atendimento**.
2. Toque em **Ler QR Code com a câmera** e aponte para o QR do visitante. Na primeira vez, o celular pede permissão para usar a câmera: permita.
   Sem câmera ou com QR ilegível: digite o código de 12 letras e números (com ou sem os hífens) e toque em **Conferir voucher**.
3. Confira na tela a atividade, o horário, a quantidade de pessoas e a origem.
4. Se vieram menos pessoas do que o reservado, use **−** para ajustar.
5. Toque em **Confirmar participação**.

O que cada aviso quer dizer:

| Aviso | O que fazer |
|:-|:-|
| Reservado · válido para hoje | Pode confirmar |
| Voucher já utilizado | Já entrou. A tela mostra quando e quem confirmou. Nada é contado de novo |
| Voucher cancelado | Não vale. Se houver vaga, emita um novo |
| Voucher expirado | O prazo acabou. Se houver vaga, emita um novo |
| Voucher de outro dia | Só pode ser confirmado no dia da atividade |
| Voucher de outro município | É de outro portal; oriente o visitante |
| Código não encontrado | Confira a digitação; peça o comprovante ao visitante |

Você não vê nome nem telefone do visitante: só o necessário para conferir.

Se o visitante desistir na hora, toque em **Cancelar voucher** na tela de conferência: as vagas voltam para outras pessoas.

### Emitir voucher para quem não tem celular

1. Toque em **Emitir voucher**.
2. Escolha a atividade e o horário, informe cidade, UF e quantidade de pessoas (e o nome, se a atividade pedir).
3. Toque em **Emitir voucher gratuito**.
4. Toque em **Imprimir** ou mostre a tela. O código pode ser confirmado na hora em **Atendimento**.

---

## Gestor

### Criar uma atividade com reserva

1. **Conteúdo** → **Atividades com voucher** → **Nova atividade**.
2. Informe o **Nome da atividade** e o **Tipo da atividade**:
   - **Reserva gratuita:** tem horários e vagas.
   - **Registro voluntário:** atrativo de acesso livre, sem limite; o visitante só registra a visita.
3. Toque em **Criar atividade**. Ela começa **em elaboração** (não aparece no portal).
4. Complete descrição, local, **Condições da atividade**, **Máximo de pessoas por voucher** e, se precisar, marque **Pedir nome do responsável pelo grupo** e **Pedir telefone para avisos**. Peça só o que for usar.
5. Em **Novo horário**, informe data, início, término e **Vagas (pessoas)** (vazio = sem limite). Toque em **Adicionar horário**. Repita para cada horário.
6. Toque em **Publicar no portal**.

Para pausar as reservas sem tirar a atividade do ar: **Fechar para reservas** (e depois **Reabrir para reservas**). Um horário que já tem vouchers não pode mudar de hora; crie outro.

### Atrativos, eventos e prestadores

**Conteúdo** → escolha a lista → **Novo atrativo**, **Novo evento** ou **Novo prestador**. Preencha o básico, toque em criar e complete na tela seguinte (endereço, horários, descrição). Toque em **Publicar no portal** quando estiver pronto.

- **Descrição** (eventos e prestadores também têm): até 2000 caracteres. Deixe uma linha em branco entre os parágrafos.
- **Fotos** (atrativos, eventos, prestadores e atividades): na tela do cadastro, toque em **Adicionar fotos** (ou **Capa e galeria**). Use **Tirar foto** para abrir a câmera ou **Da galeria** para escolher várias de uma vez. Até 12 fotos por cadastro, JPG, PNG ou WebP até 10 MB cada.
- A primeira foto é a **capa**: aparece nas listas e no topo da página. Para trocar, toque em **Tornar capa** na foto desejada. As setas sobem ou descem uma foto na galeria; a lixeira retira a foto.
- Escreva uma **legenda** dizendo o que aparece (ela é lida por quem usa leitor de tela). Sem legenda, o portal descreve como "Foto 1 de [nome do cadastro]". O **Crédito das fotos** aparece abaixo de cada foto na galeria. Toque em **Salvar fotos**.
- Antes de publicar, o sistema apaga a localização GPS e os demais dados da câmera e reduz a foto para no máximo 2000 pixels. Use só fotos oficiais ou cedidas com autorização.
- Prestador: registre a adesão (data, responsável e comprovante). Contato interno e comprovante nunca aparecem no portal; no portal sai só o que o prestador autorizou divulgar.
- **Arquivar** tira do portal sem apagar.

### Ver e cancelar vouchers

**Vouchers** abre o mesmo Atendimento do operador: conferir pela câmera ou pelo código e emitir voucher para quem não tem celular. Para cancelar, confira o código e toque em **Cancelar voucher**: as vagas voltam na hora. O visitante também pode cancelar pelo link do comprovante.

### Relatórios

1. **Relatórios** → escolha o **Ano-base** ou um período.
2. **Baixar CSV** para planilha; **Imprimir ou salvar PDF** para arquivo ou impressão.
3. Para publicar em site, rede social ou ofício, use **Para divulgação**: só números agregados, sem nome nem contato.

Como ler os números:
- **Vouchers emitidos e pessoas reservadas** são reservas, não visitas.
- **Participações confirmadas** são pessoas conferidas na entrada, não turistas únicos (a mesma pessoa pode participar de várias atividades).
- **Registros voluntários** são adesões ao sistema, não a contagem de todas as visitas ao atrativo.

### Evidências das ações

1. **Mais** → **Evidências** → **Nova evidência** (ou o atalho em Início).
2. Informe tipo da ação, título, descrição, **Data de realização** (quando aconteceu) e **Responsável pela ação**.
3. Na tela da evidência, use **Enviar foto ou anexo**: fotos JPEG ou PNG até 5 MB; listas de presença, atas e outros em PDF, JPEG ou PNG até 10 MB. Toda foto e anexo pede legenda.
4. **Retirar** tira um arquivo da evidência e da minuta (o arquivo continua guardado). Se alguém que aparece no arquivo pedir a exclusão, peça à assessoria a **exclusão definitiva** (ver [PRIVACIDADE.md](PRIVACIDADE.md)).

Tudo o que muda fica no **Histórico de alterações** da evidência, com quem e quando.

### Minuta do relatório de implantação

**Mais** → **Minuta do relatório de implantação**. A minuta junta atividades, indicadores e evidências do ano-base. Escreva metodologia, limitações, análise e recomendações e toque em **Salvar seções**. Os campos de identificação e assinatura saem em branco para preencher à mão. A minuta não substitui a análise do órgão estadual e não garante pontuação no ICMS Ecológico.

### Equipe

1. **Mais** → **Equipe** → **Convidar pessoa**.
2. Informe o **E-mail** de trabalho, o nome (opcional) e o papel: **gestor** (tudo do município) ou **operador** (só atendimento e emissão de vouchers). Toque em **Enviar convite**.
3. A pessoa recebe o e-mail e cria a própria senha. Enquanto não entrar, aparece **Ainda não entrou**.
4. Para tirar o acesso: **Desativar acesso**. Para devolver: **Reativar acesso**.

Ninguém altera o próprio papel nem o próprio acesso.

### Configurações do portal

**Mais** → **Configurações**: nome de exibição, cor (precisa ter bom contraste com o branco; o painel recusa cores claras demais), contato da Secretaria, link da Ouvidoria, aviso de privacidade (só depois da revisão jurídica), referência da cartilha do ICMS Ecológico, **Prazo para apagar nome e contato dos visitantes (dias)** e as imagens oficiais (logo e foto de capa). Toque em **Salvar configurações**.

### Auditoria

**Mais** → **Auditoria**: quem incluiu, alterou ou excluiu dados, e quando, com filtros por pessoa, período, área e tipo de ação. Mostra os campos alterados, não os valores.

---

## Problemas comuns

| Situação | O que fazer |
|:-|:-|
| A câmera não abre | Permita a câmera nas configurações do navegador para o site, ou digite o código |
| O visitante perdeu o comprovante | Peça o código, se ele anotou. Sem código, emita um novo voucher se houver vaga |
| Horário lotado | No portal o horário deixa de aceitar reservas. Crie outro horário ou aumente as vagas |
| Mensagem em vermelho num formulário | Ela diz o campo e o que corrigir; corrija e salve de novo |
| Não chegou o e-mail do convite | Confira a caixa de spam e o e-mail digitado; peça para o gestor reenviar |
