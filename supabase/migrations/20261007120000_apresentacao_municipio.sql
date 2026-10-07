-- Fase 9 (item 9.1): frase curta de apresentação do município, mostrada no card da home
-- turismo.to e no painel sobre a capa do portal. Até 160 caracteres, editada em Configurações
-- pelo gestor (a política configuracoes_alteracao e o grant de update da tabela já cobrem a coluna).

alter table public.configuracoes_municipio
  add column apresentacao text
    check (apresentacao is null or length(trim(apresentacao)) between 1 and 160);

comment on column public.configuracoes_municipio.apresentacao is
  'Frase curta de apresentação (até 160 caracteres) no card da home e na capa do portal.';
