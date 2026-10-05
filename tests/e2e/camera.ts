import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matrizDoQr } from "../../src/lib/voucher/qr";

/**
 * Câmera falsa do Chromium (--use-file-for-fake-video-capture): um vídeo Y4M em tons de cinza.
 * Com um código, o quadro mostra o QR gerado pela própria aplicação; sem código, fica em branco.
 */
export const ARQUIVO_CAMERA = join(tmpdir(), "turismo-to-camera.y4m");

const L = 640;
const A = 480;

export function gravarCamera(codigo: string | null) {
  const y = Buffer.alloc(L * A, 235);
  if (codigo) {
    const m = matrizDoQr(codigo);
    const escala = Math.floor(400 / m.length);
    const x0 = Math.floor((L - m.length * escala) / 2);
    const y0 = Math.floor((A - m.length * escala) / 2);
    for (let i = 0; i < m.length * escala; i++) {
      for (let j = 0; j < m.length * escala; j++) {
        if (m[Math.floor(i / escala)][Math.floor(j / escala)]) y[(y0 + i) * L + (x0 + j)] = 16;
      }
    }
  }
  const croma = Buffer.alloc((L / 2) * (A / 2), 128);
  const quadro = Buffer.concat([Buffer.from("FRAME\n"), y, croma, croma]);
  writeFileSync(ARQUIVO_CAMERA, Buffer.concat([Buffer.from(`YUV4MPEG2 W${L} H${A} F10:1 Ip A1:1 C420jpeg\n`), quadro, quadro]));
}
