const HOSTING_FALLBACK = "Unknown";
const CONNECTION_FALLBACK = "Onbekend";

function normalizeHosting(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return HOSTING_FALLBACK;
  }

  const cleaned = value.toLowerCase();
  if (cleaned.includes("saas")) {
    return "SaaS";
  }

  if (cleaned.includes("on") && cleaned.includes("prem")) {
    return "On-premises";
  }

  return value;
}

function nodeColorByHosting(hosting) {
  if (hosting === "SaaS") {
    return "#0d9488";
  }

  if (hosting === "On-premises") {
    return "#b45309";
  }

  return "#475569";
}

export function buildGraph(records) {
  const nodeMap = new Map();
  const edges = [];

  records.forEach((record, index) => {
    const sourceName = String(record.bronapplicatie || "").trim();
    const targetName = String(record.doelapplicatie || "").trim();

    if (!sourceName || !targetName) {
      return;
    }

    const sourceHosting = normalizeHosting(record.bronHosting);
    const targetHosting = normalizeHosting(record.doelHosting);

    if (!nodeMap.has(sourceName)) {
      nodeMap.set(sourceName, {
        id: sourceName,
        type: "appNode",
        data: {
          label: sourceName,
          hosting: sourceHosting,
          color: nodeColorByHosting(sourceHosting)
        },
        position: { x: 0, y: 0 },
        style: {
          borderRadius: 10,
          border: `2px solid ${nodeColorByHosting(sourceHosting)}`,
          padding: 10,
          background: "#f8fafc",
          minWidth: 180
        }
      });
    }

    if (!nodeMap.has(targetName)) {
      nodeMap.set(targetName, {
        id: targetName,
        type: "appNode",
        data: {
          label: targetName,
          hosting: targetHosting,
          color: nodeColorByHosting(targetHosting)
        },
        position: { x: 0, y: 0 },
        style: {
          borderRadius: 10,
          border: `2px solid ${nodeColorByHosting(targetHosting)}`,
          padding: 10,
          background: "#f8fafc",
          minWidth: 180
        }
      });
    }

    edges.push({
      id: `${sourceName}-${targetName}-${index}`,
      source: sourceName,
      target: targetName,
      label: record.koppelingSoort || CONNECTION_FALLBACK,
      markerEnd: {
        type: "arrowclosed"
      },
      style: {
        stroke: "#334155",
        strokeWidth: 1.6
      },
      labelStyle: {
        fill: "#0f172a",
        fontWeight: 600
      },
      labelBgPadding: [5, 2],
      labelBgBorderRadius: 4,
      labelBgStyle: {
        fill: "#e2e8f0"
      }
    });
  });

  return {
    nodes: Array.from(nodeMap.values()),
    edges
  };
}
