"use client";

import { BarChart3, Ellipsis, House, Layers, ScanLine, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@/lib/auth/acesso";
import { cn } from "@/lib/utils";

type Item = { href: string; rotulo: string; icone: typeof House; ativo: (caminho: string) => boolean };

// O caminho pode vir reescrito (/m/<slug>/admin/...) ou como o navegador vê (/admin/...).
const depoisDeAdmin = (c: string) => c.replace(/^.*\/admin/, "") || "/";

const ITENS_GESTOR: Item[] = [
  { href: "/admin", rotulo: "Início", icone: House, ativo: (c) => depoisDeAdmin(c) === "/" },
  {
    href: "/admin/conteudo",
    rotulo: "Conteúdo",
    icone: Layers,
    ativo: (c) => /^\/(conteudo|atividades|atrativos|eventos|prestadores)/.test(depoisDeAdmin(c)),
  },
  {
    href: "/admin/atendimento",
    rotulo: "Vouchers",
    icone: Ticket,
    ativo: (c) => /^\/(atendimento|vouchers)/.test(depoisDeAdmin(c)),
  },
  { href: "/admin/relatorios", rotulo: "Relatórios", icone: BarChart3, ativo: (c) => depoisDeAdmin(c).startsWith("/relatorios") },
  {
    href: "/admin/mais",
    rotulo: "Mais",
    icone: Ellipsis,
    ativo: (c) => /^\/(mais|configuracoes|equipe|auditoria|assessoria|evidencias)/.test(depoisDeAdmin(c)),
  },
];

const ITENS_OPERADOR: Item[] = [
  { href: "/admin/atendimento", rotulo: "Atendimento", icone: ScanLine, ativo: (c) => depoisDeAdmin(c).startsWith("/atendimento") },
  { href: "/admin/vouchers/emitir", rotulo: "Emitir voucher", icone: Ticket, ativo: (c) => depoisDeAdmin(c).startsWith("/vouchers") },
  { href: "/admin/mais", rotulo: "Mais", icone: Ellipsis, ativo: (c) => depoisDeAdmin(c).startsWith("/mais") },
];

/** Barra inferior do painel no celular (CLAUDE.md, "Interface"). O operador vê só atendimento e emissão. */
export function NavegacaoPainel({ papel }: { papel: Papel }) {
  const caminho = usePathname();
  const itens = papel === "operador" ? ITENS_OPERADOR : ITENS_GESTOR;
  return (
    <nav
      aria-label="Navegação do painel"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-superficie pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {itens.map(({ href, rotulo, icone: Icone, ativo }) => {
          const atual = ativo(caminho);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-center gap-0.5 text-xs no-underline",
                  atual ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icone aria-hidden="true" className="size-6" strokeWidth={atual ? 2.2 : 2} />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
