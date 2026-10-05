"use client";

import { Camera, CameraOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { codigoValido, formatarCodigo, normalizarCodigo } from "@/lib/voucher/esquemas";

type Detector = { detect(fonte: HTMLVideoElement): Promise<{ rawValue: string }[]> };

/**
 * Usa o BarcodeDetector nativo quando o navegador lê QR (Chrome no Android); senão, o ponyfill
 * `barcode-detector` (zxing-wasm), com o .wasm servido pelo próprio site.
 */
async function criarDetector(): Promise<Detector> {
  const nativo = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } })
    .BarcodeDetector;
  if (nativo && (await nativo.getSupportedFormats()).includes("qr_code")) {
    return new nativo({ formats: ["qr_code"] });
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (caminho: string, prefixo: string) =>
        caminho.endsWith(".wasm") ? `${location.origin}/vendor/zxing_reader.wasm` : prefixo + caminho,
    },
  });
  return new BarcodeDetector({ formats: ["qr_code"] });
}

export function LeitorQr() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [ligada, setLigada] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [digitado, setDigitado] = useState("");
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);

  const abrir = (bruto: string) => {
    const codigo = normalizarCodigo(bruto);
    if (!codigoValido(codigo)) {
      setErroCodigo("Código inválido. Ele tem 12 letras e números, no formato XXXX-XXXX-XXXX.");
      return false;
    }
    router.push(`/admin/atendimento/${codigo}`);
    return true;
  };

  useEffect(() => {
    if (!ligada) return;
    let fluxo: MediaStream | null = null;
    let parar = false;
    let espera: ReturnType<typeof setTimeout>;

    (async () => {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (parar || !video.current) return;
        video.current.srcObject = fluxo;
        await video.current.play();
        const detector = await criarDetector();
        const ler = async () => {
          if (parar || !video.current) return;
          try {
            const achados = await detector.detect(video.current);
            const valido = achados.map((a) => a.rawValue).find((t) => codigoValido(t));
            if (valido) {
              parar = true;
              router.push(`/admin/atendimento/${normalizarCodigo(valido)}`);
              return;
            }
            if (achados.length) setAviso("Este QR Code não é de um voucher do Turismo.TO.");
          } catch {
            // quadro ainda sem imagem; tenta no próximo
          }
          espera = setTimeout(ler, 250);
        };
        ler();
      } catch {
        setAviso("Não foi possível usar a câmera. Permita o acesso à câmera no navegador ou digite o código abaixo.");
        setLigada(false);
      }
    })();

    return () => {
      parar = true;
      clearTimeout(espera);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, [ligada, router]);

  const canto = "absolute size-11 border-dourado";
  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex h-[330px] items-center justify-center overflow-hidden rounded-3xl bg-[#16211B]">
        <video ref={video} muted playsInline aria-label="Imagem da câmera" className={ligada ? "absolute inset-0 size-full object-cover" : "hidden"} />
        <div aria-hidden="true" className={`${canto} top-14 left-[70px] rounded-tl-[10px] border-t-[5px] border-l-[5px]`} />
        <div aria-hidden="true" className={`${canto} top-14 right-[70px] rounded-tr-[10px] border-t-[5px] border-r-[5px]`} />
        <div aria-hidden="true" className={`${canto} bottom-[72px] left-[70px] rounded-bl-[10px] border-b-[5px] border-l-[5px]`} />
        <div aria-hidden="true" className={`${canto} right-[70px] bottom-[72px] rounded-br-[10px] border-r-[5px] border-b-[5px]`} />
        {ligada ? (
          <p className="absolute inset-x-0 bottom-[18px] text-center text-[15px] text-white">Aponte a câmera para o QR Code</p>
        ) : (
          <Button type="button" size="lg" className="relative z-10 bg-white text-[#16211B] hover:bg-white/90" onClick={() => { setAviso(null); setLigada(true); }}>
            <Camera aria-hidden="true" className="size-5" /> Ler QR Code com a câmera
          </Button>
        )}
        {ligada ? (
          <Button type="button" variant="outline" size="sm" className="absolute top-3 right-3 z-10 bg-white" onClick={() => setLigada(false)}>
            <CameraOff aria-hidden="true" /> Desligar
          </Button>
        ) : null}
      </div>
      {aviso ? (
        <p role="alert" className="rounded-xl bg-dourado-suave p-3 text-dourado-texto">
          {aviso}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          abrir(digitado);
        }}
      >
        <Label htmlFor="codigo" className="text-[15px]">
          Ou digite o código
        </Label>
        <div className="flex gap-2">
          <Input
            id="codigo"
            name="codigo"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ex.: 7KQ4-M2XP-9WDT"
            value={digitado}
            aria-invalid={erroCodigo ? true : undefined}
            aria-describedby={erroCodigo ? "codigo-erro" : undefined}
            onChange={(e) => {
              setErroCodigo(null);
              const n = normalizarCodigo(e.target.value).slice(0, 12);
              setDigitado(n.length > 8 ? formatarCodigo(n.padEnd(12, " ")).trim() : n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n);
            }}
            className="h-[54px] flex-1 font-mono text-[17px] tracking-[0.04em]"
          />
          <Button type="submit" size="lg" className="h-[54px]">
            Buscar
          </Button>
        </div>
        {erroCodigo ? (
          <span id="codigo-erro" className="text-sm font-bold text-erro">
            {erroCodigo}
          </span>
        ) : null}
      </form>
    </div>
  );
}
