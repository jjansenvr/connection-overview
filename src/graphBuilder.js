import { MarkerType } from "reactflow";

const HOSTING_FALLBACK = "Unknown";
const CONNECTION_FALLBACK = "Onbekend";
const LAYER_X_GAP = 300;
const LAYER_Y_GAP = 140;

function layoutNodes(nodes, edges) {
  const ids = nodes.map((node) => node.id);
  const inDegree = new Map(ids.map((id) => [id, 0]));
  const neighbors = new Map(ids.map((id) => [id, []]));
  const layerById = new Map(ids.map((id) => [id, 0]));

  edges.forEach((edge) => {
    if (!neighbors.has(edge.source) || !inDegree.has(edge.target)) {
      return;
    }

    neighbors.get(edge.source).push(edge.target);
    inDegree.set(edge.target, inDegree.get(edge.target) + 1);
  });

  const queue = ids
    .filter((id) => inDegree.get(id) === 0)
    .sort((a, b) => a.localeCompare(b));

  while (queue.length) {
    const current = queue.shift();
    const currentLayer = layerById.get(current);

    neighbors.get(current).forEach((next) => {
      const nextLayer = Math.max(layerById.get(next), currentLayer + 1);
      layerById.set(next, nextLayer);

      const nextInDegree = inDegree.get(next) - 1;
      inDegree.set(next, nextInDegree);

      if (nextInDegree === 0) {
        queue.push(next);
      }
    });
  }

  // If cycles exist, remaining nodes still get a deterministic layer.
  ids.forEach((id) => {
    if (inDegree.get(id) > 0 && layerById.get(id) === 0) {
      layerById.set(id, 1);
    }
  });

  const nodesByLayer = new Map();
  ids.forEach((id) => {
    const layer = layerById.get(id) || 0;
    const bucket = nodesByLayer.get(layer) || [];
    bucket.push(id);
    nodesByLayer.set(layer, bucket);
  });

  const positionById = new Map();
  Array.from(nodesByLayer.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([layer, layerIds]) => {
      layerIds.sort((a, b) => a.localeCompare(b));

      layerIds.forEach((id, row) => {
        positionById.set(id, {
          x: layer * LAYER_X_GAP,
          y: row * LAYER_Y_GAP
        });
      });
    });

  return nodes.map((node) => {
    const positioned = positionById.get(node.id);

    if (!positioned) {
      return node;
    }

    return {
      ...node,
      sourcePosition: "right",
      targetPosition: "left",
      position: {
        x: positioned.x,
        y: positioned.y
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

  function ensureNode(name) {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, {
        id: name,
        label: name,
        types: new Set(),
        opmerkingen: new Set()
      });
    }

    return nodeMap.get(name);
  }

  records.forEach((record, index) => {
    const sourceName = String(record.bronapplicatie || "").trim();
    const targetName = String(record.doelapplicatie || "").trim();

    if (!sourceName || !targetName) {
      return;
    }

    const sourceNode = ensureNode(sourceName);
    const targetNode = ensureNode(targetName);

    const sourceHosting = normalizeHosting(record.bronHosting);
    const targetHosting = normalizeHosting(record.doelHosting);

    sourceNode.types.add(sourceHosting || HOSTING_FALLBACK);
    targetNode.types.add(targetHosting || HOSTING_FALLBACK);

    const sourceOpmerking = String(record.bronOpmerking || "").trim();
    const targetOpmerking = String(record.doelOpmerking || "").trim();
    if (sourceOpmerking) {
      sourceNode.opmerkingen.add(sourceOpmerking);
    }
    if (targetOpmerking) {
      targetNode.opmerkingen.add(targetOpmerking);
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

  const nodes = Array.from(nodeMap.values()).map((node) => {
    const types = Array.from(node.types);
    const opmerkingen = Array.from(node.opmerkingen);
    const primaryType = types[0] || HOSTING_FALLBACK;

    return {
      id: node.id,
      type: "appNode",
      data: {
        label: node.label,
        types,
        opmerkingen,
        color: nodeColorByHosting(primaryType)
      },
      position: { x: 0, y: 0 },
      style: {
        borderRadius: 10,
        border: `2px solid ${nodeColorByHosting(primaryType)}`,
        padding: 10,
        background: "#f8fafc",
        minWidth: 210
      }
    };
  });

  return {
    nodes: layoutNodes(nodes, edges),
    edges
  };
}
