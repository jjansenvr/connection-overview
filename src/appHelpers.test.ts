import { describe, expect, it } from "vitest";

import {
  formatFromFileName,
  getConnectedNodeIds,
  getTableColumns,
  interpolate,
  serializeRowsByFormat
} from "./utils/appHelpers";

describe("appHelpers", () => {
  it("interpolates template placeholders", () => {
    expect(interpolate("Hello {name}", { name: "team" })).toBe("Hello team");
    expect(interpolate("Missing {value}", {})).toBe("Missing ");
  });

  it("infers format from file extension", () => {
    expect(formatFromFileName("data.csv")).toBe("csv");
    expect(formatFromFileName("data.yaml")).toBe("yaml");
    expect(formatFromFileName("data.yml")).toBe("yaml");
    expect(formatFromFileName("unknown.ext", "csv")).toBe("csv");
  });

  it("serializes rows to csv and keeps column order", () => {
    const csv = serializeRowsByFormat(
      [
        {
          bronapplicatie: "ERP",
          doelapplicatie: "CRM",
          bronHosting: "SaaS",
          doelHosting: "On premises",
          koppelingSoort: "API",
          integratieOplossing: "Mule",
          bronOpmerking: "src",
          doelOpmerking: "tgt"
        }
      ],
      "csv"
    );

    expect(csv).toContain("bronapplicatie,doelapplicatie,bronHosting,doelHosting,koppelingSoort");
    expect(csv.indexOf("integratieOplossing")).toBeGreaterThan(csv.indexOf("koppelingSoort"));
    expect(csv.indexOf("bronOpmerking")).toBeGreaterThan(csv.indexOf("integratieOplossing"));
    expect(csv.indexOf("doelOpmerking")).toBeGreaterThan(csv.indexOf("bronOpmerking"));
    expect(csv).toContain("ERP,CRM,SaaS,On premises,API,Mule,src,tgt");
  });

  it("serializes rows to json for yaml format", () => {
    const serialized = serializeRowsByFormat([{ bronapplicatie: "ERP", doelapplicatie: "CRM" }], "yaml");
    expect(JSON.parse(serialized)).toEqual([
      {
        bronapplicatie: "ERP",
        doelapplicatie: "CRM",
        bronHosting: "",
        doelHosting: "",
        koppelingSoort: "",
        integratieOplossing: "",
        bronOpmerking: "",
        doelOpmerking: ""
      }
    ]);
  });

  it("builds localized table column keys", () => {
    const columns = getTableColumns((key) => key);
    expect(columns.map((column) => column.key)).toEqual([
      "bronapplicatie",
      "doelapplicatie",
      "bronHosting",
      "doelHosting",
      "koppelingSoort",
      "integratieOplossing",
      "bronOpmerking",
      "doelOpmerking"
    ]);
    expect(columns[0].label).toBe("sourceApplication");
  });

  it("collects connected nodes with breadth-first traversal", () => {
    const connected = getConnectedNodeIds("A", [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "D", target: "E" }
    ]);

    expect(Array.from(connected).sort()).toEqual(["A", "B", "C"]);
  });
});
