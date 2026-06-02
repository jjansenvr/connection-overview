import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  useEdgesState,
  useNodesState
} from "reactflow";
import "reactflow/dist/style.css";

import { applyElkLayout, buildGraph } from "./graphBuilder";
import { parseByFormat } from "./parsers";
import sampleYaml from "./sample-data.yaml?raw";

const sampleCsv = `Bronapplicatie,Bronopmerking,Doelapplicatie,Doelopmerking,Brontype,Doeltype,Koppelingsoort
ERP,Stuurt orderdata door,CRM,Ontvangt orderdata,On premises,SaaS,API
CRM,Levert klantupdates,Datawarehouse,Verwerkt periodieke export,SaaS,On premises,Batch
HRM,Publiceert medewerker-events,ERP,Valideert medewerkers,SaaS,On premises,Event`;

function NodeLabel({ data }) {
  return (
    <div className="node-label">
      <Handle type="target" position={Position.Left} />
      <div className="node-title">{data.label}</div>
      <div className="node-badges">
        {(data.types || []).map((type) => (
          <div key={type} className="node-badge" style={{ backgroundColor: data.color }}>
            {type}
          </div>
        ))}
      </div>
      {(data.opmerkingen || []).length ? (
        <div className="node-remarks">{data.opmerkingen.join(" • ")}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { appNode: NodeLabel };

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}

function getConnectedNodeIds(startId, edges) {
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

export default function App() {
  const [format, setFormat] = useState("yaml");
  const [input, setInput] = useState(sampleYaml);
  const [error, setError] = useState("");
  const [dragEnabled, setDragEnabled] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const { theme, toggle: toggleTheme } = useTheme();

  const parsed = useMemo(() => {
    try {
      const rows = parseByFormat(input, format);
      setError("");
      return rows;
    } catch (err) {
      setError(err.message || "Failed to parse data.");
      return [];
    }
  }, [input, format]);

  const graph = useMemo(() => buildGraph(parsed), [parsed]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    applyElkLayout(graph.nodes, graph.edges).then(({ nodes: ln, edges: le }) => {
      setNodes(ln);
      setEdges(le);
    });
    setSelectedNodeId(null);
  }, [graph, setEdges, setNodes]);

  const selectedCluster = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }

    return getConnectedNodeIds(selectedNodeId, edges);
  }, [selectedNodeId, edges]);

  const displayNodes = useMemo(() => {
    if (!selectedCluster) {
      return nodes;
    }

    return nodes.map((node) => {
      const isInFocus = selectedCluster.has(node.id);
      const isSelected = node.id === selectedNodeId;

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isInFocus ? 1 : 0.2,
          boxShadow: isSelected ? "0 0 0 3px rgba(15, 118, 110, 0.28)" : "none"
        }
      };
    });
  }, [nodes, selectedCluster, selectedNodeId]);

  const displayEdges = useMemo(() => {
    if (!selectedCluster) {
      return edges;
    }

    return edges.map((edge) => {
      const isInFocus = selectedCluster.has(edge.source) && selectedCluster.has(edge.target);

      return {
        ...edge,
        animated: isInFocus,
        style: {
          ...edge.style,
          opacity: isInFocus ? 1 : 0.12,
          strokeWidth: isInFocus ? 2.2 : 1
        },
        labelStyle: {
          ...edge.labelStyle,
          opacity: isInFocus ? 1 : 0.2
        },
        labelBgStyle: {
          ...edge.labelBgStyle,
          opacity: isInFocus ? 1 : 0.2
        }
      };
    });
  }, [edges, selectedCluster]);

  const handleNodeClick = useCallback(
    (_, node) => {
      setSelectedNodeId(node.id);
      const connected = getConnectedNodeIds(node.id, edges);

      if (reactFlowInstance && connected.size) {
        reactFlowInstance.fitView({
          nodes: Array.from(connected).map((id) => ({ id })),
          padding: 0.25,
          duration: 350
        });
      }
    },
    [edges, reactFlowInstance]
  );

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 250 });
    }
  }, [reactFlowInstance]);

  const onFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      setFormat("csv");
    } else if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
      setFormat("yaml");
    }

    setInput(text);
  };

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-brand">
          <h1><span className="brand-accent">Connection</span>Overview</h1>
          <p>Visualiseer applicatiekoppelingen uit CSV of YAML met React Flow.</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel left-panel">
          <div className="panel-header">
            <h2>Data Input</h2>
            <label className="file-btn">
              Bestand kiezen
              <input
                type="file"
                accept=".csv,.yaml,.yml,text/csv"
                onClick={(e) => {
                  e.currentTarget.value = "";
                }}
                onChange={onFileUpload}
              />
            </label>
          </div>

          <div className="format-row">
            <label>
              Formaat
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="yaml">YAML</option>
                <option value="csv">CSV</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setInput(format === "yaml" ? sampleYaml : sampleCsv)}
            >
              Laad voorbeeld
            </button>
          </div>

          <div className="options-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={dragEnabled}
                onChange={(e) => setDragEnabled(e.target.checked)}
              />
              Nodes verslepen
            </label>
            <span className="hint">Klik op een node om verbonden onderdelen te focussen.</span>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="Plak hier CSV of YAML data"
          />

          {error ? <p className="error">{error}</p> : null}
          <p className="meta">Records: {parsed.length}</p>
        </section>

        <section className="panel flow-panel">
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onInit={setReactFlowInstance}
            onNodeClick={handleNodeClick}
            onPaneClick={clearSelection}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesDraggable={dragEnabled}
            fitView
            minZoom={0.2}
            maxZoom={1.8}
          >
            <Background color="#cbd5e1" gap={18} />
            <Controls />
            <MiniMap pannable zoomable />
            <Panel position="top-right" className="legend">
              <strong>Legend</strong>
              <span>
                <i className="dot saas" /> SaaS
              </span>
              <span>
                <i className="dot onprem" /> On-premises
              </span>
              <span>
                <i className="dot unknown" /> Unknown
              </span>
            </Panel>
          </ReactFlow>
        </section>
      </main>
    </div>
  );
}
