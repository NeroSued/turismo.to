import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/cron/manter-ativo/route";
import { cronAutorizado } from "../../src/lib/cron";
import { ambienteLocal } from "../ambiente";

const SEGREDO = "segredo-de-teste-do-cron-0123456789";

describe("cronAutorizado", () => {
  it("aceita só o Bearer exato", () => {
    expect(cronAutorizado(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true);
    expect(cronAutorizado(null, SEGREDO)).toBe(false);
    expect(cronAutorizado(SEGREDO, SEGREDO)).toBe(false);
    expect(cronAutorizado(`Bearer ${SEGREDO}x`, SEGREDO)).toBe(false);
    expect(cronAutorizado("Bearer outro", SEGREDO)).toBe(false);
  });

  it("recusa tudo quando CRON_SECRET falta ou é curto", () => {
    expect(cronAutorizado("Bearer ", "")).toBe(false);
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
    expect(cronAutorizado("Bearer curto", "curto")).toBe(false);
  });
});

describe("GET /api/cron/manter-ativo", () => {
  const anterior = { ...process.env };
  beforeEach(() => {
    const { url, publishable } = ambienteLocal();
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable;
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3000";
    process.env.CRON_SECRET = SEGREDO;
  });
  afterEach(() => {
    process.env = { ...anterior };
  });

  const chamar = (cabecalhos: Record<string, string>) =>
    GET(new Request("http://localhost/api/cron/manter-ativo", { headers: cabecalhos }));

  it("sem o segredo responde 401 sem consultar nada", async () => {
    const r = await chamar({});
    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(await r.json()).toEqual({ ok: false });
  });

  it("com segredo errado responde 401", async () => {
    const r = await chamar({ authorization: "Bearer errado-errado-errado-errado" });
    expect(r.status).toBe(401);
  });

  it("com o segredo consulta o banco e responde só { ok: true }", async () => {
    const r = await chamar({ authorization: `Bearer ${SEGREDO}` });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
