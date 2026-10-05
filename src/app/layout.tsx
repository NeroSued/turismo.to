import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const fonteTexto = Atkinson_Hyperlegible({
  variable: "--font-texto",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
});

const fonteTitulo = Bricolage_Grotesque({
  variable: "--font-titulo",
  weight: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Turismo.TO",
    template: "%s · Turismo.TO",
  },
  description:
    "Atrativos, eventos e atividades gratuitas dos municípios participantes do Tocantins.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EEF0EA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${fonteTexto.variable} ${fonteTitulo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
