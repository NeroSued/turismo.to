"use server";

import { z } from "zod";
import { contextoDaAcao, contextoDoMunicipio, SEM_PERMISSAO } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { PASTAS, caminhoNovo, deHex } from "./caminhos";
import { REGRAS, validarArquivo, type Bucket } from "./validacao";

const esquema = z.object({
  municipioId: z.uuid().optional(),
  tipo: z.enum(["foto", "documento", "foto_interna", "foto_original"]),
  pasta: z.enum(PASTAS),
  tamanho: z.number().int().positive(),
  inicio: z.string().regex(/^[0-9a-f]{0,32}$/),
});

export type Autorizacao =
  | { ok: true; bucket: Bucket; caminho: string; token: string; mime: string }
  | { ok: false; erro: string };

/**
 * Primeiro passo do envio direto ao Storage (o limite de 4,5 MB por requisição da Vercel
 * impede que arquivos maiores passem pela action). Confere o papel de gestor, o tamanho e o
 * tipo real pelos primeiros bytes, e emite uma URL de envio assinada com a sessão do usuário:
 * a política do Storage confere de novo que ele é gestor do município da pasta. A action do
 * formulário recebe só o caminho e relê o arquivo no Storage antes de aceitá-lo.
 */
export async function autorizarEnvio(entrada: z.input<typeof esquema>): Promise<Autorizacao> {
  const e = esquema.safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Envio inválido. Recarregue a página e tente de novo." };
  const { municipioId, tipo, pasta, tamanho, inicio } = e.data;
  const ctx = municipioId ? await contextoDoMunicipio(municipioId, ["gestor"]) : await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };

  const v = validarArquivo(tipo, tamanho, deHex(inicio));
  if (!v.ok) return v;

  const caminho = caminhoNovo(ctx.municipio.id, pasta, v.extensao);
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.storage.from(REGRAS[tipo].bucket).createSignedUploadUrl(caminho);
  if (error) return { ok: false, erro: "Não foi possível preparar o envio agora. Confira a conexão e tente de novo." };
  return { ok: true, bucket: REGRAS[tipo].bucket, caminho, token: data.token, mime: v.mime };
}
