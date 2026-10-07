import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { AMBIENTE, sql } from "./alvo";

// Conteúdo [E2E] para o layout de computador (Fase 9), criado direto no banco e no bucket
// `publico` do alvo (Supabase local ou projeto "Turismo.TO Teste", conferidos em ambienteE2E):
// atrativos com 6, 3 e 1 foto, uma atividade com sessão, um evento com cartaz e um prestador,
// além da capa e da frase de apresentação de Palmeirópolis. `limpar()` desfaz tudo.

const TONS: [string, string][] = [
  ["#2F5D46", "#C9D2C2"],
  ["#6B4A0E", "#F3E6C8"],
  ["#1F4D3A", "#9FB8A6"],
  ["#4A5320", "#D3D8C6"],
  ["#2B4A6B", "#BCC8D8"],
  ["#7A3B2E", "#E8CFC4"],
];

/** Foto de mentira (degradê com relevo), em WebP, do tamanho de uma foto publicada. */
async function foto(n: number, largura = 1600, altura = 1067) {
  const [a, b] = TONS[n % TONS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <path d="M0 ${altura * 0.72} L${largura * 0.3} ${altura * 0.45} L${largura * 0.55} ${altura * 0.62} L${largura * 0.8} ${altura * 0.38} L${largura} ${altura * 0.58} L${largura} ${altura} L0 ${altura} Z" fill="${a}" opacity="0.55"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);

export type Vitrine = Awaited<ReturnType<typeof criarVitrine>>;

export async function criarVitrine() {
  const suf = randomBytes(3).toString("hex");
  const municipio = sql("select id from public.municipios where slug = 'palmeiropolis'");
  const antes = sql(
    "select coalesce(capa_caminho, '') || '|' || coalesce(apresentacao, '') from public.configuracoes_municipio where municipio_id = (select id from public.municipios where slug = 'palmeiropolis')",
  );
  const admin = createClient(AMBIENTE.url, AMBIENTE.secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const caminhos: string[] = [];
  let n = 0;
  async function enviar(largura?: number, altura?: number) {
    const caminho = `${municipio}/fotos/${randomUUID()}.webp`;
    const { error } = await admin.storage.from("publico").upload(caminho, await foto(n++, largura, altura), { contentType: "image/webp" });
    if (error) throw new Error(`Falha ao enviar foto de teste: ${error.message}`);
    caminhos.push(caminho);
    return caminho;
  }

  const ids = {
    mirante: randomUUID(),
    igreja: randomUUID(),
    museu: randomUUID(),
    atividade: randomUUID(),
    evento: randomUUID(),
    prestador: randomUUID(),
  };
  const nomes = {
    mirante: `[E2E] Mirante da Serra ${suf}`,
    igreja: `[E2E] Igreja Matriz ${suf}`,
    museu: `[E2E] Casa da Memória ${suf}`,
    atividade: `[E2E] Caminhada ao mirante ${suf}`,
    evento: `[E2E] Festival do Pequi ${suf}`,
    prestador: `[E2E] Pousada Serra Azul ${suf}`,
  };
  const legendas = Array.from({ length: 6 }, (_, i) => `Vista ${i + 1} do mirante ${suf}`);
  const credito = "Secretaria de Turismo [E2E]";

  const capa = await enviar(2000, 900);
  const fotosMirante = [];
  for (let i = 0; i < 6; i++) fotosMirante.push(await enviar());
  const fotosMuseu = [await enviar(), await enviar(), await enviar()];
  const fotoIgreja = await enviar();
  const cartaz = await enviar(800, 1000);
  const fotoPrestador = await enviar();

  const m = q(municipio);
  sql(`
    insert into public.atrativos (id, municipio_id, nome, categoria, descricao, horarios, contato, condicoes_acesso, acessibilidade,
      orientacoes_ambientais, endereco, latitude, longitude, status) values
      ('${ids.mirante}', ${m}, ${q(nomes.mirante)}, 'natureza',
       ${q("Do alto da serra se vê o vale inteiro e o lago da represa. A trilha é curta e sombreada.\n\nA melhor hora é o fim da tarde, quando o sol se põe atrás dos morros.")},
       'Todos os dias, das 7h às 18h', '(63) 3000-0000', 'Estrada de terra, 4 km; carro baixo passa na seca', 'Mirante com rampa; trilha sem acessibilidade',
       'Leve seu lixo de volta. Não acenda fogo.', 'Saída pela TO-280, km 12', -13.0446, -48.4027, 'publicado'),
      ('${ids.igreja}', ${m}, ${q(nomes.igreja)}, 'religioso', ${q("Igreja do centro histórico.")}, null, null, null, null, null, null, null, null, 'publicado'),
      ('${ids.museu}', ${m}, ${q(nomes.museu)}, 'cultura', ${q("Acervo de fotografias e objetos da história da cidade.")}, 'Terça a sábado, das 8h às 17h', null, null, null, null, null, null, null, 'publicado');
    insert into public.atividades (id, municipio_id, titulo, modo, status, descricao, local_encontro, atrativo_id, condicoes) values
      ('${ids.atividade}', ${m}, ${q(nomes.atividade)}, 'reserva', 'publicado', ${q("Caminhada guiada até o mirante, com paradas para observar aves.")},
       'Praça da Matriz', '${ids.mirante}', 'Leve água e use calçado fechado.');
    insert into public.sessoes (municipio_id, atividade_id, inicio, fim, capacidade_pessoas) values
      (${m}, '${ids.atividade}', now() + interval '3 days', now() + interval '3 days 3 hours', 15);
    insert into public.eventos (id, municipio_id, titulo, descricao, local, organizador, inicio, fim, atrativo_id, status) values
      ('${ids.evento}', ${m}, ${q(nomes.evento)}, ${q("Feira de produtos do cerrado, música e comidas com pequi.")}, 'Praça da Matriz', 'Secretaria de Turismo',
       now() - interval '1 day', now() + interval '2 days', '${ids.mirante}', 'publicado');
    insert into public.prestadores (id, municipio_id, nome_publico, categoria, servicos, situacao_rede, status) values
      ('${ids.prestador}', ${m}, ${q(nomes.prestador)}, 'hospedagem', 'Quartos para até 4 pessoas', 'participante', 'publicado');
    insert into public.fotos (municipio_id, caminho, legenda, credito, atrativo_id, ordem) values
      ${fotosMirante.map((c, i) => `(${m}, ${q(c)}, ${q(legendas[i])}, ${q(credito)}, '${ids.mirante}', ${i})`).join(",\n      ")},
      ${fotosMuseu.map((c, i) => `(${m}, ${q(c)}, null, null, '${ids.museu}', ${i})`).join(",\n      ")},
      (${m}, ${q(fotoIgreja)}, null, null, '${ids.igreja}', 0);
    insert into public.fotos (municipio_id, caminho, legenda, evento_id, ordem) values (${m}, ${q(cartaz)}, 'Cartaz do festival', '${ids.evento}', 0);
    insert into public.fotos (municipio_id, caminho, legenda, prestador_id, ordem) values (${m}, ${q(fotoPrestador)}, null, '${ids.prestador}', 0);
    update public.configuracoes_municipio set capa_caminho = ${q(capa)}, apresentacao = ${q(`Serra, lago e festas do cerrado no sul do Tocantins ${suf}`)}
      where municipio_id = ${m};
  `);

  async function limpar() {
    const [capaAntes, apresentacaoAntes] = antes.split("|");
    sql(`
      update public.configuracoes_municipio set capa_caminho = ${q(capaAntes || null)}, apresentacao = ${q(apresentacaoAntes || null)} where municipio_id = ${m};
      delete from public.vouchers where atividade_id = '${ids.atividade}';
      delete from public.sessoes where atividade_id = '${ids.atividade}';
      delete from public.atividades where id = '${ids.atividade}';
      delete from public.eventos where id = '${ids.evento}';
      delete from public.prestadores where id = '${ids.prestador}';
      delete from public.atrativos where id in ('${ids.mirante}', '${ids.igreja}', '${ids.museu}');
    `);
    await admin.storage.from("publico").remove(caminhos);
  }

  return { suf, ids, nomes, legendas, credito, limpar };
}
