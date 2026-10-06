import { describe, expect, it } from "vitest";
import { parametroDeOverride, resolverMunicipio, slugDoHost, urlDoHub, urlDoMunicipio } from "@/lib/municipio/resolver";

const base = { dominioRaiz: "turismo.to", parametro: null, cookie: null, overridePermitido: false };

describe("slugDoHost", () => {
  it("lê o subdomínio do domínio raiz, com ou sem porta", () => {
    expect(slugDoHost("palmeiropolis.turismo.to", "turismo.to")).toBe("palmeiropolis");
    expect(slugDoHost("palmeiropolis.localhost:3000", "localhost:3000")).toBe("palmeiropolis");
    expect(slugDoHost("PEIXE.Turismo.TO", "turismo.to")).toBe("peixe");
  });

  it("domínio raiz, www e hosts de fora não têm município", () => {
    expect(slugDoHost("turismo.to", "turismo.to")).toBeNull();
    expect(slugDoHost("www.turismo.to", "turismo.to")).toBeNull();
    expect(slugDoHost("turismo-to-abc.vercel.app", "turismo.to")).toBeNull();
    expect(slugDoHost("palmeiropolis.turismo.to.evil.com", "turismo.to")).toBeNull();
    expect(slugDoHost(null, "turismo.to")).toBeNull();
  });
});

describe("resolverMunicipio", () => {
  it("host do município abre o portal; raiz abre o hub", () => {
    expect(resolverMunicipio({ ...base, host: "peixe.turismo.to" })).toEqual({ tipo: "municipio", slug: "peixe" });
    expect(resolverMunicipio({ ...base, host: "turismo.to" })).toEqual({ tipo: "hub" });
  });

  it("?municipio= é ignorado quando ALLOW_TENANT_OVERRIDE não está definida", () => {
    expect(resolverMunicipio({ ...base, host: "turismo.to", parametro: "peixe" })).toEqual({ tipo: "hub" });
    expect(resolverMunicipio({ ...base, host: "turismo.to", cookie: "peixe" })).toEqual({ tipo: "hub" });
    expect(
      resolverMunicipio({ ...base, host: "palmeiropolis.turismo.to", parametro: "peixe", cookie: "peixe" }),
    ).toEqual({ tipo: "municipio", slug: "palmeiropolis" });
  });

  it("com override permitido, parâmetro e cookie escolhem o município", () => {
    const o = { ...base, overridePermitido: true, host: "x.vercel.app" };
    expect(resolverMunicipio({ ...o, parametro: "peixe" })).toEqual({ tipo: "municipio", slug: "peixe" });
    expect(resolverMunicipio({ ...o, cookie: "ananas" })).toEqual({ tipo: "municipio", slug: "ananas" });
    expect(resolverMunicipio({ ...o, parametro: "peixe", cookie: "ananas" })).toEqual({ tipo: "municipio", slug: "peixe" });
    expect(resolverMunicipio({ ...o, parametro: "", cookie: "ananas" })).toEqual({ tipo: "hub" });
  });
});

describe("links", () => {
  it("local e produção usam subdomínio; preview usa o parâmetro", () => {
    expect(urlDoMunicipio("peixe", "localhost:3000", true)).toBe("http://peixe.localhost:3000/");
    expect(urlDoMunicipio("peixe", "turismo.to", false)).toBe("https://peixe.turismo.to/");
    expect(urlDoMunicipio("peixe", "turismo-to.vercel.app", true)).toBe("/?municipio=peixe");
    expect(urlDoHub("turismo.to", false)).toBe("https://turismo.to/");
    expect(urlDoHub("turismo-to.vercel.app", true)).toBe("/?municipio=");
  });
});

describe("parametroDeOverride", () => {
  it("aceita slug válido e vazio; ignora o que não é slug", () => {
    expect(parametroDeOverride("Palmeiropolis")).toBe("palmeiropolis");
    expect(parametroDeOverride("")).toBe("");
    expect(parametroDeOverride(null)).toBeNull();
    expect(parametroDeOverride("6f1c2c7e-8f5a-4b8e-9a43-0f2d9c8b1a11")).toBeNull();
    expect(parametroDeOverride("../admin")).toBeNull();
  });
});
