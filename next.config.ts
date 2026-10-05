import type { NextConfig } from "next";

// Fotos publicadas saem do bucket `publico` do Supabase e passam pelo otimizador do Next.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
// Só o Supabase LOCAL (127.0.0.1/localhost, desenvolvimento e E2E) precisa de IP local liberado.
const supabaseLocal = supabase !== null && ["127.0.0.1", "localhost"].includes(supabase.hostname);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Documentos de até 10 MB (bucket interno) mais a sobra do multipart. O tipo e o tamanho
      // de cada arquivo são conferidos de novo no servidor (src/lib/arquivos/validacao.ts).
      bodySizeLimit: "11mb",
    },
  },
  images: {
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(":", "") as "http" | "https",
            hostname: supabase.hostname,
            port: supabase.port,
            pathname: "/storage/v1/object/public/publico/**",
          },
        ]
      : [],
    dangerouslyAllowLocalIP: supabaseLocal,
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
