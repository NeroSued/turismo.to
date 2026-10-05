-- Fase 5.1: anonimização de nome e contato dos vouchers (D10).
-- Prazo por município em configuracoes_municipio.dias_anonimizacao (padrão 90 dias), contado
-- a partir do dia da atividade (data_visita, fuso America/Araguaina). Cidade, UF, pessoas,
-- pessoas atendidas e estado ficam, então os relatórios não mudam.

alter table public.vouchers add column anonimizado_em timestamptz;

comment on column public.vouchers.anonimizado_em is
  'Quando nome e contato foram apagados pela rotina de anonimização (D10). Nulo = ainda não anonimizado.';

comment on column public.configuracoes_municipio.dias_anonimizacao is
  'Dias após o dia da atividade para apagar nome e contato dos vouchers (D10).';

create function privado.anonimizar_vouchers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  update public.vouchers v
  set nome_responsavel = null, contato = null, anonimizado_em = now()
  from public.configuracoes_municipio c
  where c.municipio_id = v.municipio_id
    and (v.nome_responsavel is not null or v.contato is not null)
    and v.data_visita + c.dias_anonimizacao <= privado.hoje_local();
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke all on function privado.anonimizar_vouchers() from public;

comment on function privado.anonimizar_vouchers() is
  'Apaga nome e contato dos vouchers cujo dia da atividade passou do prazo do município. Roda todo dia pelo pg_cron.';

-- 03:15 UTC = 00:15 em America/Araguaina (UTC-3, sem horário de verão).
select cron.schedule('anonimizar-vouchers', '15 3 * * *', 'select privado.anonimizar_vouchers()');
