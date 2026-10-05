-- Fase 2 (item 2.1): atrativos, eventos, prestadores, adesões à rede e fotos com legenda.
--
-- Regras (SPEC 4, CLAUDE.md):
--   * Estados rascunho (em elaboração), publicado e arquivado. O público só vê o publicado,
--     de município ativo. Não há exclusão: conteúdo sai do ar sendo arquivado.
--   * Relacionamentos entre tabelas de município usam FK composta (municipio_id, ...).
--   * Contatos internos e comprovantes de adesão ficam em adesoes_prestador, que só o
--     gestor do município (e o admin) lê. Nada dela chega ao anônimo.
--   * Caminhos de arquivo começam pela pasta do município ("<municipio_id>/..."), a mesma
--     que as políticas do Storage conferem (migration seguinte).

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

-- Caminho de arquivo dentro da pasta do município, sem "..", barras duplas ou caracteres estranhos.
create function privado.caminho_do_municipio(p_caminho text, p_municipio_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_caminho like p_municipio_id::text || '/%'
     and p_caminho ~ '^[0-9a-f-]{36}(/[a-z0-9][a-z0-9_.-]{0,80}){1,3}$'
     and p_caminho !~ '\.\.';
$$;

-- Contraste WCAG da cor #RRGGBB com o branco (texto branco sobre a cor primária).
create function privado.contraste_com_branco(p_cor text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_canais numeric[] := array[]::numeric[];
  v_c numeric;
  i int;
begin
  if p_cor !~ '^#[0-9A-Fa-f]{6}$' then
    return 0;
  end if;
  for i in 0..2 loop
    v_c := (('x' || substr(p_cor, 2 + i * 2, 2))::bit(8)::int) / 255.0;
    v_canais := v_canais || case when v_c <= 0.03928 then v_c / 12.92 else power((v_c + 0.055) / 1.055, 2.4) end;
  end loop;
  return 1.05 / (0.2126 * v_canais[1] + 0.7152 * v_canais[2] + 0.0722 * v_canais[3] + 0.05);
end;
$$;

-- ---------------------------------------------------------------------------
-- Configurações do município: limites, capa e contraste da cor (item 2.4 usa estes campos)
-- ---------------------------------------------------------------------------

alter table public.configuracoes_municipio
  add column capa_caminho text,
  add constraint configuracoes_cor_contraste check (privado.contraste_com_branco(cor_primaria) >= 4.5),
  add constraint configuracoes_logo_na_pasta check (logo_caminho is null or privado.caminho_do_municipio(logo_caminho, municipio_id)),
  add constraint configuracoes_capa_na_pasta check (capa_caminho is null or privado.caminho_do_municipio(capa_caminho, municipio_id)),
  add constraint configuracoes_contato_tamanho check (contato_secretaria is null or length(contato_secretaria) <= 600),
  add constraint configuracoes_aviso_tamanho check (aviso_privacidade is null or length(aviso_privacidade) <= 8000),
  add constraint configuracoes_icms_tamanho check (length(trim(referencia_icms)) between 1 and 200),
  add constraint configuracoes_ouvidoria_tamanho check (ouvidoria_url is null or length(ouvidoria_url) <= 500);

comment on column public.configuracoes_municipio.capa_caminho is 'Foto de capa do portal, no bucket publico (pasta do município).';

-- ---------------------------------------------------------------------------
-- atrativos
-- ---------------------------------------------------------------------------

create table public.atrativos (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 3 and 120),
  categoria text not null check (categoria in ('natureza', 'cultura', 'historico', 'religioso', 'aventura', 'lazer', 'gastronomia', 'outro')),
  descricao text check (descricao is null or length(descricao) <= 4000),
  endereco text check (endereco is null or length(endereco) <= 300),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  horarios text check (horarios is null or length(horarios) <= 500),
  contato text check (contato is null or length(contato) <= 300),
  condicoes_acesso text check (condicoes_acesso is null or length(condicoes_acesso) <= 2000),
  acessibilidade text check (acessibilidade is null or length(acessibilidade) <= 2000),
  orientacoes_ambientais text check (orientacoes_ambientais is null or length(orientacoes_ambientais) <= 2000),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, id),
  check ((latitude is null) = (longitude is null))
);

comment on table public.atrativos is 'Atrativos turísticos. Cadastrar um atrativo nunca cria atividade com voucher.';
comment on column public.atrativos.contato is 'Contato público do atrativo (aparece no portal).';

create index atrativos_municipio_status_idx on public.atrativos (municipio_id, status);

create trigger atrativos_atualizado_em before update on public.atrativos
  for each row execute function privado.tocar_atualizado_em();

-- A atividade com voucher pode apontar para um atrativo do MESMO município (Fase 1 deixou a coluna pronta).
alter table public.atividades
  add constraint atividades_atrativo_fk foreign key (municipio_id, atrativo_id)
  references public.atrativos (municipio_id, id);

-- ---------------------------------------------------------------------------
-- eventos
-- ---------------------------------------------------------------------------

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 3 and 120),
  descricao text check (descricao is null or length(descricao) <= 4000),
  local text check (local is null or length(local) <= 300),
  organizador text check (organizador is null or length(organizador) <= 200),
  inicio timestamptz not null,
  fim timestamptz not null,
  atrativo_id uuid,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, id),
  foreign key (municipio_id, atrativo_id) references public.atrativos (municipio_id, id),
  check (fim >= inicio),
  check (fim - inicio <= interval '60 days')
);

comment on column public.eventos.atrativo_id is 'Atrativo opcional onde o evento acontece (mesmo município, FK composta).';

create index eventos_municipio_inicio_idx on public.eventos (municipio_id, status, inicio);

create trigger eventos_atualizado_em before update on public.eventos
  for each row execute function privado.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- prestadores e adesões à rede
-- ---------------------------------------------------------------------------

create table public.prestadores (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  nome_publico text not null check (length(trim(nome_publico)) between 2 and 120),
  categoria text not null check (categoria in ('hospedagem', 'alimentacao', 'guias', 'transporte', 'artesanato', 'agencia', 'outro')),
  servicos text check (servicos is null or length(servicos) <= 2000),
  contatos_publicos text check (contatos_publicos is null or length(contatos_publicos) <= 300),
  localizacao text check (localizacao is null or length(localizacao) <= 300),
  situacao_rede text not null default 'em_adesao' check (situacao_rede in ('em_adesao', 'participante', 'desligado')),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, id)
);

comment on table public.prestadores is 'Rede de prestadores. Só dados autorizados para divulgação; os internos ficam em adesoes_prestador.';
comment on column public.prestadores.contatos_publicos is 'Contatos que o prestador AUTORIZOU divulgar no portal.';

create index prestadores_municipio_status_idx on public.prestadores (municipio_id, status);

create trigger prestadores_atualizado_em before update on public.prestadores
  for each row execute function privado.tocar_atualizado_em();

create table public.adesoes_prestador (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null,
  prestador_id uuid not null,
  data_adesao date not null,
  responsavel text not null check (length(trim(responsavel)) between 2 and 120),
  contato_interno text check (contato_interno is null or length(contato_interno) <= 300),
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  comprovante_caminho text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (municipio_id, prestador_id) references public.prestadores (municipio_id, id) on delete cascade,
  unique (municipio_id, id),
  check (comprovante_caminho is null or privado.caminho_do_municipio(comprovante_caminho, municipio_id))
);

comment on table public.adesoes_prestador is 'Adesão à rede: data, responsável, contato interno e comprovante (bucket interno). Privado do município.';

create index adesoes_prestador_idx on public.adesoes_prestador (municipio_id, prestador_id, data_adesao desc);

create trigger adesoes_atualizado_em before update on public.adesoes_prestador
  for each row execute function privado.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- fotos (bucket publico), sempre de um único atrativo, evento ou prestador do mesmo município
-- ---------------------------------------------------------------------------

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios (id) on delete cascade,
  caminho text not null unique,
  legenda text not null check (length(trim(legenda)) between 3 and 200),
  atrativo_id uuid,
  evento_id uuid,
  prestador_id uuid,
  ordem integer not null default 0 check (ordem between 0 and 1000),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  foreign key (municipio_id, atrativo_id) references public.atrativos (municipio_id, id) on delete cascade,
  foreign key (municipio_id, evento_id) references public.eventos (municipio_id, id) on delete cascade,
  foreign key (municipio_id, prestador_id) references public.prestadores (municipio_id, id) on delete cascade,
  check (num_nonnulls(atrativo_id, evento_id, prestador_id) = 1),
  check (privado.caminho_do_municipio(caminho, municipio_id))
);

comment on column public.fotos.legenda is 'Legenda e texto alternativo da foto (obrigatória).';

create index fotos_atrativo_idx on public.fotos (municipio_id, atrativo_id) where atrativo_id is not null;
create index fotos_evento_idx on public.fotos (municipio_id, evento_id) where evento_id is not null;
create index fotos_prestador_idx on public.fotos (municipio_id, prestador_id) where prestador_id is not null;

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

create trigger auditoria_atrativos after insert or update or delete on public.atrativos
  for each row execute function privado.registrar_auditoria('municipio_id');
create trigger auditoria_eventos after insert or update or delete on public.eventos
  for each row execute function privado.registrar_auditoria('municipio_id');
create trigger auditoria_prestadores after insert or update or delete on public.prestadores
  for each row execute function privado.registrar_auditoria('municipio_id');
create trigger auditoria_adesoes after insert or update or delete on public.adesoes_prestador
  for each row execute function privado.registrar_auditoria('municipio_id');
create trigger auditoria_fotos after insert or update or delete on public.fotos
  for each row execute function privado.registrar_auditoria('municipio_id');

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos) e RLS
-- ---------------------------------------------------------------------------

revoke all on table public.atrativos, public.eventos, public.prestadores, public.adesoes_prestador, public.fotos
  from anon, authenticated, service_role;

grant select on table public.atrativos to anon, authenticated;
grant insert (municipio_id, nome, categoria, descricao, endereco, latitude, longitude, horarios, contato,
              condicoes_acesso, acessibilidade, orientacoes_ambientais, status)
  on table public.atrativos to authenticated;
grant update (nome, categoria, descricao, endereco, latitude, longitude, horarios, contato,
              condicoes_acesso, acessibilidade, orientacoes_ambientais, status)
  on table public.atrativos to authenticated;

grant select on table public.eventos to anon, authenticated;
grant insert (municipio_id, titulo, descricao, local, organizador, inicio, fim, atrativo_id, status)
  on table public.eventos to authenticated;
grant update (titulo, descricao, local, organizador, inicio, fim, atrativo_id, status)
  on table public.eventos to authenticated;

grant select on table public.prestadores to anon, authenticated;
grant insert (municipio_id, nome_publico, categoria, servicos, contatos_publicos, localizacao, situacao_rede, status)
  on table public.prestadores to authenticated;
grant update (nome_publico, categoria, servicos, contatos_publicos, localizacao, situacao_rede, status)
  on table public.prestadores to authenticated;

-- adesoes_prestador: nada para anon.
grant select, delete on table public.adesoes_prestador to authenticated;
grant insert (municipio_id, prestador_id, data_adesao, responsavel, contato_interno, observacoes, comprovante_caminho)
  on table public.adesoes_prestador to authenticated;
grant update (data_adesao, responsavel, contato_interno, observacoes, comprovante_caminho)
  on table public.adesoes_prestador to authenticated;

grant select on table public.fotos to anon, authenticated;
grant insert (municipio_id, caminho, legenda, atrativo_id, evento_id, prestador_id, ordem) on table public.fotos to authenticated;
grant update (legenda, ordem) on table public.fotos to authenticated;
grant delete on table public.fotos to authenticated;

grant select on table public.atrativos, public.eventos, public.prestadores, public.adesoes_prestador, public.fotos to service_role;

alter table public.atrativos enable row level security;
alter table public.eventos enable row level security;
alter table public.prestadores enable row level security;
alter table public.adesoes_prestador enable row level security;
alter table public.fotos enable row level security;

-- Conteúdo: público vê o publicado de município ativo; membros veem tudo do seu município;
-- gestor cria e altera. Sem política de exclusão.
create policy atrativos_leitura on public.atrativos for select to anon, authenticated
  using (
    (status = 'publicado' and exists (select 1 from public.municipios m where m.id = municipio_id and m.ativo))
    or (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
  );
create policy atrativos_inclusao on public.atrativos for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy atrativos_alteracao on public.atrativos for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));

create policy eventos_leitura on public.eventos for select to anon, authenticated
  using (
    (status = 'publicado' and exists (select 1 from public.municipios m where m.id = municipio_id and m.ativo))
    or (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
  );
create policy eventos_inclusao on public.eventos for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy eventos_alteracao on public.eventos for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));

create policy prestadores_leitura on public.prestadores for select to anon, authenticated
  using (
    (status = 'publicado' and exists (select 1 from public.municipios m where m.id = municipio_id and m.ativo))
    or (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
  );
create policy prestadores_inclusao on public.prestadores for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy prestadores_alteracao on public.prestadores for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));

-- Adesões: só gestor do município (e admin), em todas as operações. Operador também não lê.
create policy adesoes_leitura on public.adesoes_prestador for select to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy adesoes_inclusao on public.adesoes_prestador for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy adesoes_alteracao on public.adesoes_prestador for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy adesoes_exclusao on public.adesoes_prestador for delete to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));

-- Fotos: visíveis ao público quando o conteúdo dono está publicado (e o município ativo).
create policy fotos_leitura on public.fotos for select to anon, authenticated
  using (
    (select privado.tem_papel(municipio_id, array['gestor', 'operador']))
    or (
      exists (select 1 from public.municipios m where m.id = municipio_id and m.ativo)
      and (
        exists (select 1 from public.atrativos a where a.municipio_id = fotos.municipio_id and a.id = fotos.atrativo_id and a.status = 'publicado')
        or exists (select 1 from public.eventos e where e.municipio_id = fotos.municipio_id and e.id = fotos.evento_id and e.status = 'publicado')
        or exists (select 1 from public.prestadores p where p.municipio_id = fotos.municipio_id and p.id = fotos.prestador_id and p.status = 'publicado')
      )
    )
  );
create policy fotos_inclusao on public.fotos for insert to authenticated
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy fotos_alteracao on public.fotos for update to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])))
  with check ((select privado.tem_papel(municipio_id, array['gestor'])));
create policy fotos_exclusao on public.fotos for delete to authenticated
  using ((select privado.tem_papel(municipio_id, array['gestor'])));
