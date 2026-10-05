-- Fase 1 (item 1.2): funções do voucher.
--
-- Padrão: a regra fica em privado.* (security definer, search_path vazio) e o que a Data API
-- precisa enxergar é um invólucro em public.* com security invoker. Assim nenhuma função
-- security definer fica no schema exposto, e o privilégio EXECUTE decide quem chama:
--
--   service_role (servidor, PLANO D8): emitir_voucher_publico, consultar_voucher_token,
--                                      cancelar_voucher_token, consumir_limite_requisicao
--   authenticated (painel, com RLS):   emitir_voucher_assistido, conferir_voucher,
--                                      confirmar_voucher, cancelar_voucher_painel,
--                                      relatorio_vouchers
--
-- Erros de regra saem como exceção com errcode P0001 e mensagem igual a uma chave curta
-- (sem_vagas, atividade_indisponivel, ...). O servidor traduz para texto ao usuário.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create function privado.erro(p_chave text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_chave using errcode = 'P0001';
end;
$$;

-- Dia corrente no fuso America/Araguaina.
create function privado.hoje_local()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Araguaina')::date;
$$;

-- Código de 12 caracteres do alfabeto sem 0, O, 1, I, L (31 símbolos), com bytes aleatórios
-- e rejeição dos bytes >= 248 para não enviesar a distribuição (248 = 31 * 8).
create function privado.gerar_codigo_voucher()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_codigo text := '';
  v_bytes bytea;
  v_b integer;
  i integer;
begin
  while length(v_codigo) < 12 loop
    v_bytes := extensions.gen_random_bytes(16);
    for i in 0 .. 15 loop
      v_b := get_byte(v_bytes, i);
      if v_b < 248 and length(v_codigo) < 12 then
        v_codigo := v_codigo || substr(v_alfabeto, (v_b % 31) + 1, 1);
      end if;
    end loop;
  end loop;
  return v_codigo;
end;
$$;

-- Normaliza o que o operador digita ou o QR traz: maiúsculas, sem hífens nem espaços.
create function privado.normalizar_codigo(p_codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_codigo, ''), '[\s-]', '', 'g'));
$$;

-- Momento a partir do qual um voucher emitido expira (D7).
create function privado.limite_expiracao(p_sessao_fim timestamptz, p_data_visita date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_sessao_fim is not null then p_sessao_fim + interval '2 hours'
    else ((p_data_visita + 1)::timestamp at time zone 'America/Araguaina')
  end;
$$;

-- ---------------------------------------------------------------------------
-- Consistência de sessões
-- ---------------------------------------------------------------------------

create function privado.validar_sessao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.atividades a
                   where a.municipio_id = new.municipio_id and a.id = new.atividade_id and a.modo = 'reserva') then
      perform privado.erro('sessao_so_em_reserva');
    end if;
  elsif (new.inicio is distinct from old.inicio or new.fim is distinct from old.fim)
        and exists (select 1 from public.vouchers v where v.sessao_id = old.id) then
    -- O dia da sessão está gravado nos vouchers: mudar o horário quebraria o comprovante.
    perform privado.erro('sessao_com_vouchers');
  end if;
  return new;
end;
$$;

revoke all on function privado.validar_sessao() from public;

create trigger sessoes_validar before insert or update on public.sessoes
  for each row execute function privado.validar_sessao();

-- ---------------------------------------------------------------------------
-- Emissão (D4, D5, D6)
-- ---------------------------------------------------------------------------

-- Núcleo comum da emissão pública e assistida. Não é exposto a nenhum papel.
-- Retorna o voucher e um token novo (só o hash fica gravado). Em repetição da mesma chave
-- de idempotência devolve o mesmo voucher, sem reservar vagas de novo, e troca o token:
-- o link mais recente é o que vale (a resposta anterior pode ter se perdido).
create function privado.emitir_voucher(
  p_municipio_id uuid,
  p_atividade_id uuid,
  p_sessao_id uuid,
  p_data_visita date,
  p_pessoas integer,
  p_cidade text,
  p_uf text,
  p_nome_responsavel text,
  p_contato text,
  p_chave_idempotencia uuid,
  p_origem text,
  p_emitido_por uuid
)
returns table (voucher_id uuid, codigo text, token text, repetido boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atividade public.atividades%rowtype;
  v_sessao public.sessoes%rowtype;
  v_existente uuid;
  v_token bytea := extensions.gen_random_bytes(32);
  v_codigo text;
  v_data date;
  v_nome text := nullif(trim(coalesce(p_nome_responsavel, '')), '');
  v_contato text := nullif(trim(coalesce(p_contato, '')), '');
  v_id uuid;
  v_tentativa integer := 0;
begin
  if p_chave_idempotencia is null then
    perform privado.erro('dados_invalidos');
  end if;

  -- Serializa requisições com a mesma chave: a segunda espera a primeira e reaproveita o voucher.
  perform pg_advisory_xact_lock(hashtextextended(p_municipio_id::text || ':' || p_chave_idempotencia::text, 0));

  select v.id into v_existente from public.vouchers v
  where v.municipio_id = p_municipio_id and v.chave_idempotencia = p_chave_idempotencia;
  if found then
    update public.vouchers v set token_hash = sha256(v_token) where v.id = v_existente
    returning v.codigo into v_codigo;
    return query select v_existente, v_codigo, encode(v_token, 'hex'), true;
    return;
  end if;

  select a.* into v_atividade from public.atividades a
  join public.municipios m on m.id = a.municipio_id
  where a.municipio_id = p_municipio_id and a.id = p_atividade_id and a.status = 'publicado' and m.ativo;
  if not found then
    perform privado.erro('atividade_indisponivel');
  end if;

  if p_pessoas is null or p_pessoas < 1 or p_pessoas > v_atividade.max_pessoas_por_voucher then
    perform privado.erro('quantidade_invalida');
  end if;
  if v_atividade.exige_responsavel and v_nome is null then
    perform privado.erro('responsavel_obrigatorio');
  end if;
  if v_atividade.exige_contato and v_contato is null then
    perform privado.erro('contato_obrigatorio');
  end if;
  -- D10: nome e contato só quando a atividade exige.
  if not v_atividade.exige_responsavel then v_nome := null; end if;
  if not v_atividade.exige_contato then v_contato := null; end if;

  if v_atividade.modo = 'reserva' then
    if p_sessao_id is null then
      perform privado.erro('sessao_indisponivel');
    end if;
    -- D4: reserva de vagas por pessoas num único UPDATE condicional.
    update public.sessoes s
    set pessoas_reservadas = s.pessoas_reservadas + p_pessoas
    where s.municipio_id = p_municipio_id and s.atividade_id = p_atividade_id and s.id = p_sessao_id
      and s.ativa and s.inicio > now()
      and (s.capacidade_pessoas is null or s.pessoas_reservadas + p_pessoas <= s.capacidade_pessoas)
    returning s.* into v_sessao;
    if not found then
      if exists (select 1 from public.sessoes s
                 where s.municipio_id = p_municipio_id and s.atividade_id = p_atividade_id and s.id = p_sessao_id
                   and s.ativa and s.inicio > now()) then
        perform privado.erro('sem_vagas');
      end if;
      perform privado.erro('sessao_indisponivel');
    end if;
    v_data := (v_sessao.inicio at time zone 'America/Araguaina')::date;
  else
    if p_sessao_id is not null then
      perform privado.erro('sessao_indisponivel');
    end if;
    if p_data_visita is null or p_data_visita < privado.hoje_local() or p_data_visita > privado.hoje_local() + 365 then
      perform privado.erro('data_invalida');
    end if;
    v_data := p_data_visita;
  end if;

  loop
    v_tentativa := v_tentativa + 1;
    v_codigo := privado.gerar_codigo_voucher();
    begin
      insert into public.vouchers (
        municipio_id, atividade_id, sessao_id, codigo, token_hash, chave_idempotencia, origem,
        data_visita, pessoas, cidade, uf, nome_responsavel, contato, emitido_por
      ) values (
        p_municipio_id, p_atividade_id, p_sessao_id, v_codigo, sha256(v_token), p_chave_idempotencia, p_origem,
        v_data, p_pessoas, trim(p_cidade), upper(p_uf), v_nome, v_contato, p_emitido_por
      ) returning id into v_id;
      exit;
    exception when unique_violation then
      -- Colisão de código (improvável: 31^12 combinações). Tenta outro.
      if v_tentativa >= 5 then raise; end if;
    end;
  end loop;

  return query select v_id, v_codigo, encode(v_token, 'hex'), false;
end;
$$;

revoke all on function privado.emitir_voucher(uuid, uuid, uuid, date, integer, text, text, text, text, uuid, text, uuid) from public;

-- Emissão pública (D8, item 1): só o servidor, com a chave service_role, depois de validar
-- a entrada e o limite de requisições.
create function privado.emitir_voucher_publico(
  p_municipio_id uuid, p_atividade_id uuid, p_sessao_id uuid, p_data_visita date, p_pessoas integer,
  p_cidade text, p_uf text, p_nome_responsavel text, p_contato text, p_chave_idempotencia uuid
)
returns table (voucher_id uuid, codigo text, token text, repetido boolean)
language sql
security definer
set search_path = ''
as $$
  select * from privado.emitir_voucher(p_municipio_id, p_atividade_id, p_sessao_id, p_data_visita, p_pessoas,
    p_cidade, p_uf, p_nome_responsavel, p_contato, p_chave_idempotencia, 'publico', null);
$$;

-- Emissão assistida: operador ou gestor do município, com a própria sessão.
create function privado.emitir_voucher_assistido(
  p_municipio_id uuid, p_atividade_id uuid, p_sessao_id uuid, p_data_visita date, p_pessoas integer,
  p_cidade text, p_uf text, p_nome_responsavel text, p_contato text, p_chave_idempotencia uuid
)
returns table (voucher_id uuid, codigo text, repetido boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.tem_papel(p_municipio_id, array['gestor', 'operador']) then
    perform privado.erro('sem_permissao');
  end if;
  return query
    select e.voucher_id, e.codigo, e.repetido
    from privado.emitir_voucher(p_municipio_id, p_atividade_id, p_sessao_id, p_data_visita, p_pessoas,
      p_cidade, p_uf, p_nome_responsavel, p_contato, p_chave_idempotencia, 'assistida', (select auth.uid())) e;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expiração (D7): emitido → expirado depois do fim da sessão + 2 h (registro: fim do dia)
-- ---------------------------------------------------------------------------

create function privado.expirar_vouchers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  update public.vouchers v
  set status = 'expirado', expirado_em = now()
  where v.status = 'emitido'
    and v.data_visita <= privado.hoje_local()
    and privado.limite_expiracao((select s.fim from public.sessoes s where s.id = v.sessao_id), v.data_visita) <= now();
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke all on function privado.expirar_vouchers() from public;

-- Expira um único voucher se já passou do prazo (usado na conferência, antes do cron rodar).
create function privado.expirar_se_vencido(p_voucher_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  update public.vouchers v
  set status = 'expirado', expirado_em = now()
  where v.id = p_voucher_id and v.status = 'emitido'
    and privado.limite_expiracao((select s.fim from public.sessoes s where s.id = v.sessao_id), v.data_visita) <= now();
  get diagnostics v_qtd = row_count;
  return v_qtd > 0;
end;
$$;

revoke all on function privado.expirar_se_vencido(uuid) from public;

select cron.schedule('expirar-vouchers', '*/10 * * * *', 'select privado.expirar_vouchers()');
select cron.schedule('limpar-limites-requisicao', '17 * * * *',
  $$delete from public.limites_requisicao where janela < now() - interval '1 day'$$);

-- ---------------------------------------------------------------------------
-- Conferência e confirmação (operador ou gestor do município)
-- ---------------------------------------------------------------------------

-- Dados mínimos para conferir: nada de nome, contato ou token.
create function privado.dados_conferencia(p_voucher_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id,
    'codigo', v.codigo,
    'status', v.status,
    'origem', v.origem,
    'atividade', a.titulo,
    'modo', a.modo,
    'local_encontro', a.local_encontro,
    'data_visita', v.data_visita,
    'sessao_inicio', s.inicio,
    'sessao_fim', s.fim,
    'pessoas', v.pessoas,
    'pessoas_atendidas', v.pessoas_atendidas,
    'cidade', v.cidade,
    'uf', v.uf,
    'emitido_em', v.emitido_em,
    'utilizado_em', v.utilizado_em,
    'utilizado_por_nome', (select p.nome from public.perfis p where p.user_id = v.utilizado_por),
    'cancelado_em', v.cancelado_em,
    'expirado_em', v.expirado_em,
    'valido_hoje', v.status = 'emitido' and v.data_visita = privado.hoje_local()
  )
  from public.vouchers v
  join public.atividades a on a.municipio_id = v.municipio_id and a.id = v.atividade_id
  left join public.sessoes s on s.id = v.sessao_id
  where v.id = p_voucher_id;
$$;

revoke all on function privado.dados_conferencia(uuid) from public;

-- resultado: encontrado | nao_encontrado | outro_municipio
create function privado.conferir_voucher(p_municipio_id uuid, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_municipio uuid;
begin
  if not privado.tem_papel(p_municipio_id, array['gestor', 'operador']) then
    perform privado.erro('sem_permissao');
  end if;
  select v.id, v.municipio_id into v_id, v_municipio
  from public.vouchers v where v.codigo = privado.normalizar_codigo(p_codigo);
  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;
  if v_municipio <> p_municipio_id then
    return jsonb_build_object('resultado', 'outro_municipio');
  end if;
  perform privado.expirar_se_vencido(v_id);
  return jsonb_build_object('resultado', 'encontrado', 'voucher', privado.dados_conferencia(v_id));
end;
$$;

-- resultado: confirmado | ja_utilizado | cancelado | expirado | fora_do_dia |
--            nao_encontrado | outro_municipio
-- Confirmar de novo um voucher utilizado não altera nada (D7).
create function privado.confirmar_voucher(p_municipio_id uuid, p_codigo text, p_pessoas_atendidas integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vouchers%rowtype;
begin
  if not privado.tem_papel(p_municipio_id, array['gestor', 'operador']) then
    perform privado.erro('sem_permissao');
  end if;

  select * into v from public.vouchers x where x.codigo = privado.normalizar_codigo(p_codigo) for update;
  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;
  if v.municipio_id <> p_municipio_id then
    return jsonb_build_object('resultado', 'outro_municipio');
  end if;

  if privado.expirar_se_vencido(v.id) then
    v.status := 'expirado';
  end if;

  if v.status <> 'emitido' then
    return jsonb_build_object(
      'resultado', case v.status when 'utilizado' then 'ja_utilizado' else v.status end,
      'voucher', privado.dados_conferencia(v.id));
  end if;

  if v.data_visita <> privado.hoje_local() then
    return jsonb_build_object('resultado', 'fora_do_dia', 'voucher', privado.dados_conferencia(v.id));
  end if;

  if p_pessoas_atendidas is null or p_pessoas_atendidas < 1 or p_pessoas_atendidas > v.pessoas then
    perform privado.erro('quantidade_invalida');
  end if;

  update public.vouchers x
  set status = 'utilizado', pessoas_atendidas = p_pessoas_atendidas,
      utilizado_em = now(), utilizado_por = (select auth.uid())
  where x.id = v.id and x.status = 'emitido';

  return jsonb_build_object('resultado', 'confirmado', 'voucher', privado.dados_conferencia(v.id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelamento (devolve exatamente as pessoas do voucher, só a partir de 'emitido')
-- ---------------------------------------------------------------------------

create function privado.cancelar(p_voucher_id uuid, p_via text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao uuid;
  v_pessoas integer;
begin
  update public.vouchers v
  set status = 'cancelado', cancelado_em = now(), cancelado_via = p_via, cancelado_por = (select auth.uid())
  where v.id = p_voucher_id and v.status = 'emitido'
  returning v.sessao_id, v.pessoas into v_sessao, v_pessoas;
  if not found then
    return false;
  end if;
  if v_sessao is not null then
    update public.sessoes s set pessoas_reservadas = s.pessoas_reservadas - v_pessoas where s.id = v_sessao;
  end if;
  return true;
end;
$$;

revoke all on function privado.cancelar(uuid, text) from public;

-- resultado: cancelado | ja_utilizado | expirado | ja_cancelado | nao_encontrado | outro_municipio
create function privado.cancelar_voucher_painel(p_municipio_id uuid, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vouchers%rowtype;
begin
  if not privado.tem_papel(p_municipio_id, array['gestor', 'operador']) then
    perform privado.erro('sem_permissao');
  end if;
  select * into v from public.vouchers x where x.codigo = privado.normalizar_codigo(p_codigo) for update;
  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;
  if v.municipio_id <> p_municipio_id then
    return jsonb_build_object('resultado', 'outro_municipio');
  end if;
  perform privado.expirar_se_vencido(v.id);
  if privado.cancelar(v.id, 'painel') then
    return jsonb_build_object('resultado', 'cancelado', 'voucher', privado.dados_conferencia(v.id));
  end if;
  select x.status into v.status from public.vouchers x where x.id = v.id;
  return jsonb_build_object(
    'resultado', case v.status when 'utilizado' then 'ja_utilizado' when 'cancelado' then 'ja_cancelado' else v.status end,
    'voucher', privado.dados_conferencia(v.id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Consulta e cancelamento pelo token do visitante (D8, item 2: só service_role)
-- Token inválido e voucher inexistente recebem a mesma resposta: null.
-- ---------------------------------------------------------------------------

create function privado.voucher_por_token(p_municipio_id uuid, p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.id from public.vouchers v
  where p_token ~ '^[0-9a-f]{64}$'
    and v.token_hash = sha256(decode(p_token, 'hex'))
    and v.municipio_id = p_municipio_id;
$$;

revoke all on function privado.voucher_por_token(uuid, text) from public;

-- Comprovante do visitante: o que ele mesmo informou e o que precisa para a visita.
create function privado.consultar_voucher_token(p_municipio_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := privado.voucher_por_token(p_municipio_id, p_token);
begin
  if v_id is null then
    return null;
  end if;
  perform privado.expirar_se_vencido(v_id);
  return (
    select jsonb_build_object(
      'codigo', v.codigo,
      'status', v.status,
      'municipio', m.nome,
      'atividade', a.titulo,
      'modo', a.modo,
      'local_encontro', a.local_encontro,
      'condicoes', a.condicoes,
      'data_visita', v.data_visita,
      'sessao_inicio', s.inicio,
      'sessao_fim', s.fim,
      'pessoas', v.pessoas,
      'pessoas_atendidas', v.pessoas_atendidas,
      'cidade', v.cidade,
      'uf', v.uf,
      'nome_responsavel', v.nome_responsavel,
      'utilizado_em', v.utilizado_em,
      'cancelado_em', v.cancelado_em
    )
    from public.vouchers v
    join public.municipios m on m.id = v.municipio_id
    join public.atividades a on a.municipio_id = v.municipio_id and a.id = v.atividade_id
    left join public.sessoes s on s.id = v.sessao_id
    where v.id = v_id);
end;
$$;

-- resultado: cancelado | nao_cancelavel | nao_encontrado
create function privado.cancelar_voucher_token(p_municipio_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := privado.voucher_por_token(p_municipio_id, p_token);
begin
  if v_id is null then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;
  perform 1 from public.vouchers v where v.id = v_id for update;
  perform privado.expirar_se_vencido(v_id);
  if privado.cancelar(v_id, 'visitante') then
    return jsonb_build_object('resultado', 'cancelado');
  end if;
  return jsonb_build_object('resultado', 'nao_cancelavel');
end;
$$;

-- ---------------------------------------------------------------------------
-- Limite de requisições (D9). Conta em transação própria, antes da operação, para que
-- uma emissão recusada também conte.
-- ---------------------------------------------------------------------------

create function privado.consumir_limite_requisicao(
  p_escopo text, p_chave text, p_alvo text, p_maximo integer, p_janela_segundos integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_janela timestamptz := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);
  v_contagem integer;
begin
  insert into public.limites_requisicao as l (escopo, chave, alvo, janela, contagem)
  values (p_escopo, p_chave, p_alvo, v_janela, 1)
  on conflict (escopo, chave, alvo, janela) do update set contagem = l.contagem + 1
  returning l.contagem into v_contagem;
  return v_contagem <= p_maximo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relatório do período (item 1.8). Gestor do município ou admin.
-- Período pelo dia da atividade (data_visita). Rótulos na interface separam reserva de visita.
-- ---------------------------------------------------------------------------

create function privado.relatorio_vouchers(p_municipio_id uuid, p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.tem_papel(p_municipio_id, array['gestor']) then
    perform privado.erro('sem_permissao');
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 3660 then
    perform privado.erro('periodo_invalido');
  end if;
  return (
    with base as (
      select v.*, a.modo, a.titulo
      from public.vouchers v
      join public.atividades a on a.municipio_id = v.municipio_id and a.id = v.atividade_id
      where v.municipio_id = p_municipio_id and v.data_visita between p_inicio and p_fim
    )
    -- Bloco "reserva": vouchers de atividades com reserva gratuita.
    -- Bloco "registro voluntário": adesões ao sistema em atrativos de acesso livre.
    select jsonb_build_object(
      'inicio', p_inicio,
      'fim', p_fim,
      'emitidos', count(*) filter (where modo = 'reserva'),
      'utilizados', count(*) filter (where modo = 'reserva' and status = 'utilizado'),
      'cancelados', count(*) filter (where modo = 'reserva' and status = 'cancelado'),
      'expirados', count(*) filter (where modo = 'reserva' and status = 'expirado'),
      'aguardando', count(*) filter (where modo = 'reserva' and status = 'emitido'),
      'pessoas_reservadas', coalesce(sum(pessoas) filter (where modo = 'reserva' and status <> 'cancelado'), 0),
      'participacoes_confirmadas',
        coalesce(sum(pessoas_atendidas) filter (where modo = 'reserva' and status = 'utilizado'), 0),
      'registros_voluntarios', count(*) filter (where modo = 'registro_voluntario' and status <> 'cancelado'),
      'pessoas_registros_voluntarios',
        coalesce(sum(pessoas) filter (where modo = 'registro_voluntario' and status <> 'cancelado'), 0),
      'registros_confirmados', count(*) filter (where modo = 'registro_voluntario' and status = 'utilizado'),
      'pessoas_registros_confirmados',
        coalesce(sum(pessoas_atendidas) filter (where modo = 'registro_voluntario' and status = 'utilizado'), 0),
      'emissoes_assistidas', count(*) filter (where origem = 'assistida'),
      'por_atividade', coalesce((
        select jsonb_agg(x order by x->>'atividade')
        from (
          select jsonb_build_object(
            'atividade', b.titulo,
            'modo', b.modo,
            'emitidos', count(*),
            'utilizados', count(*) filter (where b.status = 'utilizado'),
            'cancelados', count(*) filter (where b.status = 'cancelado'),
            'expirados', count(*) filter (where b.status = 'expirado'),
            'pessoas_reservadas', coalesce(sum(b.pessoas) filter (where b.status <> 'cancelado'), 0),
            'participacoes_confirmadas', coalesce(sum(b.pessoas_atendidas) filter (where b.status = 'utilizado'), 0)
          ) as x
          from base b group by b.atividade_id, b.titulo, b.modo
        ) t), '[]'::jsonb)
    )
    from base);
end;
$$;

-- ---------------------------------------------------------------------------
-- Invólucros expostos pela Data API (security invoker) e privilégios
-- ---------------------------------------------------------------------------

create function public.emitir_voucher_publico(
  p_municipio_id uuid, p_atividade_id uuid, p_sessao_id uuid, p_data_visita date, p_pessoas integer,
  p_cidade text, p_uf text, p_nome_responsavel text, p_contato text, p_chave_idempotencia uuid
)
returns table (voucher_id uuid, codigo text, token text, repetido boolean)
language sql
security invoker
set search_path = ''
as $$
  select * from privado.emitir_voucher_publico(p_municipio_id, p_atividade_id, p_sessao_id, p_data_visita,
    p_pessoas, p_cidade, p_uf, p_nome_responsavel, p_contato, p_chave_idempotencia);
$$;

create function public.emitir_voucher_assistido(
  p_municipio_id uuid, p_atividade_id uuid, p_sessao_id uuid, p_data_visita date, p_pessoas integer,
  p_cidade text, p_uf text, p_nome_responsavel text, p_contato text, p_chave_idempotencia uuid
)
returns table (voucher_id uuid, codigo text, repetido boolean)
language sql
security invoker
set search_path = ''
as $$
  select * from privado.emitir_voucher_assistido(p_municipio_id, p_atividade_id, p_sessao_id, p_data_visita,
    p_pessoas, p_cidade, p_uf, p_nome_responsavel, p_contato, p_chave_idempotencia);
$$;

create function public.conferir_voucher(p_municipio_id uuid, p_codigo text)
returns jsonb language sql security invoker set search_path = ''
as $$ select privado.conferir_voucher(p_municipio_id, p_codigo); $$;

create function public.confirmar_voucher(p_municipio_id uuid, p_codigo text, p_pessoas_atendidas integer)
returns jsonb language sql security invoker set search_path = ''
as $$ select privado.confirmar_voucher(p_municipio_id, p_codigo, p_pessoas_atendidas); $$;

create function public.cancelar_voucher_painel(p_municipio_id uuid, p_codigo text)
returns jsonb language sql security invoker set search_path = ''
as $$ select privado.cancelar_voucher_painel(p_municipio_id, p_codigo); $$;

create function public.consultar_voucher_token(p_municipio_id uuid, p_token text)
returns jsonb language sql security invoker set search_path = ''
as $$ select privado.consultar_voucher_token(p_municipio_id, p_token); $$;

create function public.cancelar_voucher_token(p_municipio_id uuid, p_token text)
returns jsonb language sql security invoker set search_path = ''
as $$ select privado.cancelar_voucher_token(p_municipio_id, p_token); $$;

create function public.consumir_limite_requisicao(
  p_escopo text, p_chave text, p_alvo text, p_maximo integer, p_janela_segundos integer
)
returns boolean language sql security invoker set search_path = ''
as $$ select privado.consumir_limite_requisicao(p_escopo, p_chave, p_alvo, p_maximo, p_janela_segundos); $$;

create function public.relatorio_vouchers(p_municipio_id uuid, p_inicio date, p_fim date)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select privado.relatorio_vouchers(p_municipio_id, p_inicio, p_fim); $$;

-- Ninguém executa por padrão (o Postgres concede EXECUTE a PUBLIC e o Supabase a anon,
-- authenticated e service_role em funções novas).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'privado' and p.proname in (
             'erro', 'hoje_local', 'gerar_codigo_voucher', 'normalizar_codigo', 'limite_expiracao',
             'emitir_voucher_publico', 'emitir_voucher_assistido', 'dados_conferencia', 'conferir_voucher',
             'confirmar_voucher', 'cancelar_voucher_painel', 'consultar_voucher_token', 'cancelar_voucher_token',
             'consumir_limite_requisicao', 'relatorio_vouchers'))
       or (n.nspname = 'public' and p.proname in (
             'emitir_voucher_publico', 'emitir_voucher_assistido', 'conferir_voucher', 'confirmar_voucher',
             'cancelar_voucher_painel', 'consultar_voucher_token', 'cancelar_voucher_token',
             'consumir_limite_requisicao', 'relatorio_vouchers'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.assinatura);
  end loop;
end;
$$;

-- service_role: operações privilegiadas do PLANO (D8).
grant execute on function privado.emitir_voucher_publico(uuid, uuid, uuid, date, integer, text, text, text, text, uuid),
  public.emitir_voucher_publico(uuid, uuid, uuid, date, integer, text, text, text, text, uuid),
  privado.consultar_voucher_token(uuid, text), public.consultar_voucher_token(uuid, text),
  privado.cancelar_voucher_token(uuid, text), public.cancelar_voucher_token(uuid, text),
  privado.consumir_limite_requisicao(text, text, text, integer, integer),
  public.consumir_limite_requisicao(text, text, text, integer, integer)
  to service_role;

-- authenticated: painel com a sessão do usuário; as funções conferem o papel no município.
grant execute on function
  privado.emitir_voucher_assistido(uuid, uuid, uuid, date, integer, text, text, text, text, uuid),
  public.emitir_voucher_assistido(uuid, uuid, uuid, date, integer, text, text, text, text, uuid),
  privado.conferir_voucher(uuid, text), public.conferir_voucher(uuid, text),
  privado.confirmar_voucher(uuid, text, integer), public.confirmar_voucher(uuid, text, integer),
  privado.cancelar_voucher_painel(uuid, text), public.cancelar_voucher_painel(uuid, text),
  privado.relatorio_vouchers(uuid, date, date), public.relatorio_vouchers(uuid, date, date)
  to authenticated;

-- Auxiliares usadas dentro das funções acima por quem as executa (security definer roda
-- como dono, mas hoje_local e normalizar_codigo também aparecem em expressões invoker).
grant execute on function privado.hoje_local(), privado.normalizar_codigo(text) to authenticated, service_role;
