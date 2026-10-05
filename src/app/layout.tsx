import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fontes servidas pelo próprio site a partir dos pacotes @fontsource (OFL-1.1), sem baixar do Google
// no build: no clone limpo o download falhou e o build parou. O subconjunto latin cobre o português.
// (os caminhos precisam ser literais, exigência do next/font)
const fonteTexto = localFont({
  variable: "--font-texto",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

const fonteTitulo = localFont({
  variable: "--font-titulo",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
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
