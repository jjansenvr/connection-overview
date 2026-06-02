import { MarkerType } from "reactflow";
import dagre from "dagre";

const HOSTING_FALLBACK = "Unknown";
const CONNECTION_FALLBACK = "Onbekend";
const NODE_WIDTH = 220;
const NODE_HEIGHT = 84;

function layoutNodes(nodes, edges) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", ranksep: 100, nodesep: 40 });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const positioned = graph.node(node.id);

    if (!positioned) {
      return node;
    }

    return {
      ...node,
      sourcePosition: "right",
      targetPosition: "left",
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - NODE_HEIGHT / 2
      }
    };
  });
}

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
        type: MarkerType.ArrowClosed
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
    nodes: layoutNodes(Array.from(nodeMap.values()), edges),
    edges
  };
}
