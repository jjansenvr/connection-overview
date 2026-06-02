import { MarkerType } from "reactflow";

import ELK from "elkjs/lib/elk.bundled";

const HOSTING_FALLBACK = "Unknown";
const CONNECTION_FALLBACK = "Onbekend";

const NODE_WIDTH = 230;
const NODE_HEIGHT = 80;
const GROUP_PADDING = 40;

const elk = new ELK();

/** Find connected components (undirected). Returns array of Set<id>. */
function findComponents(ids, edges) {
  const adj = new Map(ids.map((id) => [id, new Set()]));
  edges.forEach(({ source, target }) => {
    if (adj.has(source) && adj.has(target)) {
      adj.get(source).add(target);
      adj.get(target).add(source);
    }
  });

  const visited = new Set();
  const components = [];

  ids.forEach((id) => {
    if (visited.has(id)) return;
    const component = new Set();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.add(cur);
      adj.get(cur).forEach((nb) => { if (!visited.has(nb)) queue.push(nb); });
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
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
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
    nodes,
    edges
  };
}
