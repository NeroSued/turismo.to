import { Pagina } from "@/components/pagina";

export default function Inicio() {
  return (
    <Pagina>
      <header className="flex items-center justify-between">
        <span className="font-heading text-[22px] font-bold">
          turismo<span className="text-dourado-texto">.to</span>
        </span>
        <span className="text-sm text-muted-foreground">Tocantins</span>
      </header>
      <h1 className="text-[30px] leading-tight font-bold">
        Turismo nos municípios participantes
      </h1>
    </Pagina>
  );
}
