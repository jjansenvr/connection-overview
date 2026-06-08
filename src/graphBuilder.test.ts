import { describe, expect, it } from "vitest";

import { buildGraph } from "./features/graph/graphBuilder";

describe("buildGraph", () => {
  it("creates nodes and edges for valid records", () => {
    const { nodes, edges } = buildGraph([
      {
        bronapplicatie: "ERP",
        doelapplicatie: "CRM",
        bronHosting: "SaaS",
        doelHosting: "On premises",
        koppelingSoort: "API",
        integratieOplossing: "Mule",
        bronOpmerking: "source",
        doelOpmerking: "target"
      }
    ]);

    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe("ERP-CRM-0");
    expect(edges[0].label).toBe("API");
    expect(edges[0].data.integrationSolution).toBe("Mule");
  });

  it("normalizes hosting variants and keeps unknown fallback", () => {
    const { nodes } = buildGraph([
      {
        bronapplicatie: "A",
        doelapplicatie: "B",
        bronHosting: "saas",
        doelHosting: ""
      }
    ], {
      hostingFallback: "Unknown Hosting",
      connectionFallback: "Unknown Connection"
    });

    const source = nodes.find((node) => node.id === "A");
    const target = nodes.find((node) => node.id === "B");

    expect(source?.data.types).toContain("SaaS");
    expect(target?.data.types).toContain("Unknown Hosting");
  });

  it("skips records without source or target", () => {
    const { nodes, edges } = buildGraph([
      { bronapplicatie: "", doelapplicatie: "B" },
      { bronapplicatie: "A", doelapplicatie: "" }
    ]);

    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("uses deterministic edge colors per integration solution", () => {
    const first = buildGraph([
      {
        bronapplicatie: "A",
        doelapplicatie: "B",
        integratieOplossing: "Boomi"
      }
    ]);
    const second = buildGraph([
      {
        bronapplicatie: "X",
        doelapplicatie: "Y",
        integratieOplossing: "Boomi"
      }
    ]);

    expect(first.edges[0].style.stroke).toBe(second.edges[0].style.stroke);
  });
});
