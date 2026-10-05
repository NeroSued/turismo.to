import { describe, expect, it } from "vitest";
import {
  diaLocal,
  formatarData,
  formatarDataComSemana,
  formatarDataHora,
  formatarHora,
  instanteLocal,
  somarDias,
} from "@/lib/datas";

describe("datas no fuso America/Araguaina", () => {
  it("interpreta dia e hora digitados no fuso local (UTC-3)", () => {
    expect(instanteLocal("2026-10-12", "08:00").toISOString()).toBe("2026-10-12T11:00:00.000Z");
    expect(instanteLocal("2026-12-31", "23:30").toISOString()).toBe("2027-01-01T02:30:00.000Z");
  });

  it("formata instantes em pt-BR no fuso local", () => {
    const i = "2026-10-12T11:00:00Z";
    expect(formatarHora(i)).toBe("08:00");
    expect(formatarData(i)).toBe("12/10/2026");
    expect(formatarDataHora(i)).toBe("12/10/2026 às 08:00");
    expect(formatarDataComSemana(i)).toBe("Seg, 12/10/2026");
  });

  it("o dia local muda às 03:00 UTC", () => {
    expect(diaLocal("2026-10-13T02:59:00Z")).toBe("2026-10-12");
    expect(diaLocal("2026-10-13T03:00:00Z")).toBe("2026-10-13");
  });

  it("dias sem horário não sofrem conversão de fuso", () => {
    expect(formatarData("2026-10-12")).toBe("12/10/2026");
    expect(formatarDataComSemana("2026-10-17")).toBe("Sáb, 17/10/2026");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("recusa entrada malformada", () => {
    expect(() => instanteLocal("12/10/2026", "08:00")).toThrow();
    expect(() => instanteLocal("2026-10-12", "8h")).toThrow();
  });
});
