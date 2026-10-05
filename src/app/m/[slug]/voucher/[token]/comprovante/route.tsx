import { ImageResponse } from "next/og";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { formatarCodigo } from "@/lib/voucher/esquemas";
import { paraComprovante } from "@/lib/voucher/formatar";
import { consultarPorToken } from "@/lib/voucher/publico";
import { caminhoDoQr, matrizDoQr } from "@/lib/voucher/qr";

const PRIVADO = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };

/** Comprovante em PNG para o botão "Salvar". Mesma consulta (e mesmo limite) da página do token. */
export async function GET(_: Request, { params }: RouteContext<"/m/[slug]/voucher/[token]/comprovante">) {
  const { slug, token } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  const v = municipio ? await consultarPorToken(municipio.id, token) : null;
  if (!v || v === "limite") {
    return new Response("Voucher não encontrado.", { status: 404, headers: PRIVADO });
  }
  const d = paraComprovante(v, v.municipio);
  const matriz = matrizDoQr(v.codigo);
  const qr = `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matriz.length} ${matriz.length}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${caminhoDoQr(matriz)}" fill="#16211B"/></svg>`,
  ).toString("base64")}`;

  const linha = (rotulo: string, valor: string) => (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
      <span style={{ fontSize: 22, color: "#4F5A52" }}>{rotulo}</span>
      <span style={{ fontSize: 30, fontWeight: 700 }}>{valor}</span>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#16211B" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", background: "#1F4D3A", color: "#FFFFFF", padding: "32px 40px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, letterSpacing: 3 }}>VOUCHER TURÍSTICO</span>
            <span style={{ fontSize: 44, fontWeight: 700 }}>{`${d.municipio} · TO`}</span>
          </div>
          <span style={{ fontSize: 26, fontWeight: 700, background: "#FFFFFF", color: "#16211B", padding: "6px 18px", borderRadius: 999 }}>
            Gratuito
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 40px 8px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- o ImageResponse (Satori) só aceita <img> */}
          {v.status === "emitido" ? <img src={qr} width={420} height={420} alt="" /> : null}
          <span style={{ fontSize: 24, color: "#4F5A52", marginTop: 16 }}>Código do voucher</span>
          <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: 6 }}>{formatarCodigo(v.codigo)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "8px 40px 40px" }}>
          {linha("Atividade", d.atividade)}
          {linha("Data e horário", d.horario ? `${d.data} às ${d.horario}` : d.data)}
          {linha("Pessoas", String(d.pessoas))}
          {linha("Origem", d.origem)}
          {linha(d.modo === "reserva" ? "Ponto de encontro" : "Local", d.localEncontro ?? "[Local informado pela Secretaria]")}
          <span style={{ fontSize: 22, color: "#4F5A52", marginTop: 24 }}>
            Apresente este código à equipe no local. Atividade gratuita: nenhum pagamento é solicitado.
          </span>
        </div>
      </div>
    ),
    { width: 760, height: 1320, headers: PRIVADO },
  );
}
