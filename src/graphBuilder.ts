import { MarkerType } from "reactflow";

import ELK from "elkjs/lib/elk.bundled";

const DEFAULT_LABELS = {
  hostingFallback: "Unknown",
  connectionFallback: "Unknown"
};

const NODE_WIDTH = 230;
const NODE_HEIGHT = 80;
const GROUP_PADDING = 40;

const elk = new ELK();

/** Find connected components (undirected). Returns array of Set<id>. */
function findComponents(ids: string[], edges: Array<{ source: string; target: string }>) {
  const adj = new Map<string, Set<string>>(
    ids.map((id) => [id, new Set<string>()])
  );
  edges.forEach(({ source, target }) => {
    if (adj.has(source) && adj.has(target)) {
      const sourceNeighbors = adj.get(source);
      const targetNeighbors = adj.get(target);
      sourceNeighbors?.add(target);
      targetNeighbors?.add(source);
    }
  });

  const visited = new Set<string>();
  const components: Array<Set<string>> = [];

  ids.forEach((id) => {
    if (visited.has(id)) return;
    const component = new Set<string>();
    const queue: string[] = [id];
    while (queue.length) {
      const cur = queue.shift();
      if (!cur) {
        continue;
      }
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.add(cur);
      const neighbors = adj.get(cur);
      neighbors?.forEach((nb) => {
        if (!visited.has(nb)) {
          queue.push(nb);
        }
      });
    }
    components.push(component);
  });

  return components;
}

export async function applyElkLayout(nodes, edges) {
  const ids = nodes.map((n) => n.id);
  const components = findComponents(ids, edges);

  // Build one ELK compound graph: a root with one child section per component.
  // Components with a single node are grouped together in an "isolated" section.
  const isolated = components.filter((c) => c.size === 1);
  const connected = components.filter((c) => c.size > 1);

  const sections = [];

  connected.forEach((component, i) => {
    const memberIds = Array.from(component);
    sections.push({
      id: `__group_${i}`,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.layered.spacing.nodeNodeBetweenLayers": "140",
        "elk.spacing.nodeNode": "50",
        "elk.padding": `[top=${GROUP_PADDING},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
      },
      children: memberIds.map((id) => ({ id, width: NODE_WIDTH, height: NODE_HEIGHT })),
      edges: edges
        .filter(({ source, target }) => component.has(source) && component.has(target))
        .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    });
  });

  if (isolated.length) {
    const memberIds = isolated.flatMap((c) => Array.from(c));
    sections.push({
      id: "__group_isolated",
      layoutOptions: {
        "elk.algorithm": "rectpacking",
        "elk.spacing.nodeNode": "50",
        "elk.padding": `[top=${GROUP_PADDING},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
      },
      children: memberIds.map((id) => ({ id, width: NODE_WIDTH, height: NODE_HEIGHT })),
      edges: [],
    });
  }

  const graph = {
    id: "__root",
    layoutOptions: {
      "elk.algorithm": "rectpacking",
      "elk.spacing.nodeNode": "60",
      "elk.padding": "[top=20,left=20,bottom=20,right=20]",
    },
    children: sections,
    edges: [],
  };

  const laid = await elk.layout(graph);

  // Build a map: nodeId -> absolute position
  const posMap = new Map();
  laid.children.forEach((section) => {
    const gx = section.x ?? 0;
    const gy = section.y ?? 0;
    (section.children || []).forEach((child) => {
      posMap.set(child.id, { x: gx + (child.x ?? 0), y: gy + (child.y ?? 0) });
    });
  });

  // Build group (parent) nodes for connected components
  const groupNodes = laid.children.map((section) => ({
    id: section.id,
    type: "group",
    position: { x: section.x ?? 0, y: section.y ?? 0 },
    style: {
      width: section.width,
      height: section.height,
      borderRadius: 12,
      border: "1.5px solid var(--border-dim)",
      background: "transparent",
    },
    data: { label: "" },
    selectable: false,
    focusable: false,
  }));

  // Assign positions and parentNode to app nodes
  const laidNodes = nodes.map((node) => {
    const abs = posMap.get(node.id);
    if (!abs) return { ...node, sourcePosition: "right", targetPosition: "left" };

    // Find which section this node belongs to
    const section = laid.children.find((s) =>
      (s.children || []).some((c) => c.id === node.id)
    );
    const gx = section?.x ?? 0;
    const gy = section?.y ?? 0;

    return {
      ...node,
      parentNode: section?.id,
      extent: "parent",
      sourcePosition: "right",
      targetPosition: "left",
      position: { x: abs.x - gx, y: abs.y - gy },
    };
  });

  return { nodes: [...groupNodes, ...laidNodes], edges };
}

function normalizeHosting(raw, labels) {
  const value = String(raw || "").trim();
  if (!value) {
    return labels.hostingFallback;
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

const DEFAULT_INTEGRATION_EDGE_COLOR = "#64748b";

const INTEGRATION_EDGE_PALETTE = [
  "#ff006e",
  "#fb5607",
  "#ffbe0b",
  "#3a86ff",
  "#00b4d8",
  "#06d6a0",
  "#8338ec",
  "#ef476f",
  "#118ab2",
  "#f15bb5"
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function edgeColorByIntegrationSolution(solution) {
  const normalized = String(solution || "").trim();
  if (!normalized) {
    return DEFAULT_INTEGRATION_EDGE_COLOR;
  }

  const paletteIndex = hashString(normalized.toLowerCase()) % INTEGRATION_EDGE_PALETTE.length;
  return INTEGRATION_EDGE_PALETTE[paletteIndex];
}

export function buildGraph(records, labels = DEFAULT_LABELS) {
  const nodeMap = new Map();
  const edges = [];
  const resolvedLabels = { ...DEFAULT_LABELS, ...labels };

  function ensureNode(name) {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, {
        id: name,
        label: name,
        types: new Set(),
        bronOpmerkingen: new Set(),
        doelOpmerkingen: new Set()
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

    const sourceHosting = normalizeHosting(record.bronHosting, resolvedLabels);
    const targetHosting = normalizeHosting(record.doelHosting, resolvedLabels);

    sourceNode.types.add(sourceHosting || resolvedLabels.hostingFallback);
    targetNode.types.add(targetHosting || resolvedLabels.hostingFallback);

    const sourceOpmerking = String(record.bronOpmerking || "").trim();
    const targetOpmerking = String(record.doelOpmerking || "").trim();
    const integrationSolution = String(record.integratieOplossing || "").trim();
    const hasIntegrationSolution = Boolean(integrationSolution);
    const edgeColor = edgeColorByIntegrationSolution(integrationSolution);
    if (sourceOpmerking) {
      sourceNode.bronOpmerkingen.add(sourceOpmerking);
    }
    if (targetOpmerking) {
      targetNode.doelOpmerkingen.add(targetOpmerking);
    }

    edges.push({
      id: `${sourceName}-${targetName}-${index}`,
      source: sourceName,
      target: targetName,
      type: "remarkEdge",
      label: record.koppelingSoort || resolvedLabels.connectionFallback,
      data: {
        recordIndex: index,
        sourceRemark: sourceOpmerking,
        targetRemark: targetOpmerking,
        integrationSolution,
        hasIntegrationSolution
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor
      },
      style: {
        stroke: edgeColor,
        strokeWidth: 1.6
      },
      labelStyle: {
        fill: hasIntegrationSolution ? edgeColor : "var(--text-primary)",
        fontWeight: 600
      },
      labelBgPadding: [5, 2],
      labelBgBorderRadius: 4,
      labelBgStyle: {
        fill: "var(--bg-tertiary)"
      }
    });
  });

  const nodes = Array.from(nodeMap.values()).map((node) => {
    const types = Array.from(node.types);
    const bronOpmerkingen = Array.from(node.bronOpmerkingen);
    const doelOpmerkingen = Array.from(node.doelOpmerkingen);
    const primaryType = types[0] || resolvedLabels.hostingFallback;

    return {
      id: node.id,
      type: "appNode",
      data: {
        label: node.label,
        types,
        bronOpmerkingen,
        doelOpmerkingen,
        color: nodeColorByHosting(primaryType)
      },
      position: { x: 0, y: 0 },
      style: {
        borderRadius: 10,
        border: `2.5px solid ${nodeColorByHosting(primaryType)}`,
        padding: 10,
        background: "var(--node-bg)",
        minWidth: 210
      }
    };
  });

  return {
    nodes,
    edges
  };
}
