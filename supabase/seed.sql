-- Os sete municípios atendidos (docs/SPEC.md, seção 1). Vale para qualquer ambiente.
-- Idempotente: pode rodar mais de uma vez. A configuração de cada um é criada por trigger.

insert into public.municipios (slug, nome) values
  ('palmeiropolis', 'Palmeirópolis'),
  ('saosalvador', 'São Salvador do Tocantins'),
  ('jaudotocantins', 'Jaú do Tocantins'),
  ('parana', 'Paranã'),
  ('arraias', 'Arraias'),
  ('peixe', 'Peixe'),
  ('ananas', 'Ananás')
on conflict (slug) do update set nome = excluded.nome;
