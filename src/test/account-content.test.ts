import { describe, expect, it } from "vitest";
import {
  formatDeliveredAccountContent,
  isAccountContent,
  parseAccountFields,
} from "@/lib/accountContent";

describe("account delivery content", () => {
  it("recognizes a tab-separated account even if it was stored as a code", () => {
    const content = "TDP090\tFC 26 Standard Edition\thq2rpe@batica.com.ar\tDuda3523\tPRIMARIA\tPS4";

    expect(isAccountContent(content)).toBe(true);
    expect(parseAccountFields(content)).toEqual([
      { label: "Código", value: "TDP090" },
      { label: "Juego", value: "FC 26 Standard Edition" },
      { label: "Email", value: "hq2rpe@batica.com.ar" },
      { label: "Contraseña", value: "Duda3523" },
      { label: "Tipo", value: "PRIMARIA" },
      { label: "Consola", value: "PS4" },
    ]);
  });

  it("normalizes a labeled account and keeps simple keys as keys", () => {
    const raw = "TDP090 email: hq2rpe@batica.com.ar\nclave: Duda3523";
    const notes = "TDP090 | Primaria | PS4";

    expect(isAccountContent(raw, notes)).toBe(true);
    expect(formatDeliveredAccountContent({
      content: raw,
      notes,
      title: "FC 26 Standard Edition",
    })).toBe("TDP090\tFC 26 Standard Edition\thq2rpe@batica.com.ar\tDuda3523\tPRIMARIA\tPS4");
    expect(isAccountContent("prueba1")).toBe(false);
  });
});
