import Papa from "papaparse";

import { TABLE_ROW_KEYS } from "../config/appConfig";

export function interpolate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

export function getTableColumns(t) {
  return [
    { key: "bronapplicatie", label: t("sourceApplication") },
    { key: "doelapplicatie", label: t("targetApplication") },
    { key: "bronHosting", label: t("sourceType") },
    { key: "doelHosting", label: t("targetType") },
    { key: "koppelingSoort", label: t("connectionType") },
    { key: "integratieOplossing", label: t("integrationSolution") },
    { key: "bronOpmerking", label: t("sourceRemark") },
    { key: "doelOpmerking", label: t("targetRemark") }
  ];
}

export function formatFromFileName(fileName, fallbackFormat = "yaml") {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return "yaml";
  }
  return fallbackFormat;
}

export function serializeRowsByFormat(rows, format) {
  const normalizedRows = (rows || []).map((row) => {
    const normalized = {};
    TABLE_ROW_KEYS.forEach((key) => {
      normalized[key] = String(row?.[key] ?? "");
    });
    return normalized;
  });

  if (format === "csv") {
    return Papa.unparse(normalizedRows, {
      header: true,
      columns: TABLE_ROW_KEYS,
      skipEmptyLines: false
    });
  }

  return JSON.stringify(normalizedRows, null, 2);
}

export function getConnectedNodeIds(startId, edges) {
  const adjacency = new Map();

  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }
    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set());
    }

    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  });

  const visited = new Set([startId]);
  const queue = [startId];

  while (queue.length) {
    const current = queue.shift();
    const neighbors = adjacency.get(current) || new Set();

    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  return visited;
}
