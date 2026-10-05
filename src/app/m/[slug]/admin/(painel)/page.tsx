import { Pagina } from "@/components/pagina";

export default function VisaoGeral() {
  return (
    <Pagina className="pt-2">
      <h1 className="text-[26px] font-bold">Visão geral</h1>
      <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
        O painel ainda não tem atividades nem indicadores. O cadastro de atividades e a emissão de
        vouchers chegam na próxima etapa do sistema.
      </p>
    </Pagina>
  );
}
