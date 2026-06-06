import { describe, expect, it } from "vitest";

import { parseByFormat } from "./parsers";

describe("parseByFormat hosting aliases", () => {
  it("keeps source/target hosting when YAML uses internal camelCase keys", () => {
    const yamlText = `
- bronapplicatie: ERP
  doelapplicatie: CRM
  bronHosting: SaaS
  doelHosting: On premises
  koppelingSoort: API
`;

    const rows = parseByFormat(yamlText, "yaml");

    expect(rows).toHaveLength(1);
    expect(rows[0].bronHosting).toBe("SaaS");
    expect(rows[0].doelHosting).toBe("On premises");
  });

  it("keeps source/target hosting when CSV uses internal camelCase headers", () => {
    const csvText = [
      "bronapplicatie,doelapplicatie,bronHosting,doelHosting,koppelingSoort",
      "ERP,CRM,SaaS,On premises,API"
    ].join("\n");

    const rows = parseByFormat(csvText, "csv");

    expect(rows).toHaveLength(1);
    expect(rows[0].bronHosting).toBe("SaaS");
    expect(rows[0].doelHosting).toBe("On premises");
  });
});
