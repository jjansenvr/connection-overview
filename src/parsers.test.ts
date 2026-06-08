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

  it("maps english aliases and remarks", () => {
    const csvText = [
      "Source,Target,Connection type,Integration solution,Source remark,Target remark",
      "ERP,CRM,API,Mule,Source note,Target note"
    ].join("\n");

    const rows = parseByFormat(csvText, "csv");

    expect(rows[0]).toMatchObject({
      bronapplicatie: "ERP",
      doelapplicatie: "CRM",
      koppelingSoort: "API",
      integratieOplossing: "Mule",
      bronOpmerking: "Source note",
      doelOpmerking: "Target note"
    });
  });

  it("throws a clear error when yaml is not a list", () => {
    expect(() => parseByFormat("key: value", "yaml")).toThrow("YAML should contain a list of records.");
  });

  it("throws for unsupported format", () => {
    expect(() => parseByFormat("{}", "json")).toThrow("Unsupported format: json");
  });

  it("throws CSV parse error for malformed quoted fields", () => {
    const malformedCsv = [
      "Source,Target",
      '"ERP,CRM'
    ].join("\n");

    expect(() => parseByFormat(malformedCsv, "csv")).toThrow(/CSV parse error on row/);
  });
});
