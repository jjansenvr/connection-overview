import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const SAVED_FILES_STORAGE_KEY = "connection-overview.saved-files.v1";

function formatFromFileName(fileName, fallbackFormat = "yaml") {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return "yaml";
  }
  return fallbackFormat;
}

function NodeLabel({ data }) {
  const bronOpmerkingen = data.bronOpmerkingen || [];
  const doelOpmerkingen = data.doelOpmerkingen || [];
  const hasRemarks = bronOpmerkingen.length || doelOpmerkingen.length;

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
      {hasRemarks ? (
        <div className="node-remarks">
          {bronOpmerkingen.map((opmerking) => (
            <div key={`bron-${opmerking}`}>
              <span className="remark-label">Bron:</span> {opmerking}
            </div>
          ))}
          {doelOpmerkingen.map((opmerking) => (
            <div key={`doel-${opmerking}`}>
              <span className="remark-label">Doel:</span> {opmerking}
            </div>
          ))}
        </div>
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
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [savedFiles, setSavedFiles] = useState([]);
  const [activeSavedFileId, setActiveSavedFileId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [isUploadCollapsed, setIsUploadCollapsed] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedHostings, setSelectedHostings] = useState(null);
  const [selectedConnectionTypes, setSelectedConnectionTypes] = useState(null);
  const importInputRef = useRef(null);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_FILES_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsedFiles = JSON.parse(raw);
      if (!Array.isArray(parsedFiles)) {
        return;
      }

      const normalized = parsedFiles
        .map((entry) => ({
          id: String(entry.id || ""),
          name: String(entry.name || "Naamloos bestand"),
          format: entry.format === "csv" ? "csv" : "yaml",
          input: String(entry.input || ""),
          updatedAt: Number(entry.updatedAt) || Date.now()
        }))
        .filter((entry) => entry.id && entry.input)
        .sort((a, b) => b.updatedAt - a.updatedAt);

      setSavedFiles(normalized);
    } catch {
      setSavedFiles([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_FILES_STORAGE_KEY, JSON.stringify(savedFiles));
  }, [savedFiles]);

  useEffect(() => {
    if (activeSavedFileId && !savedFiles.some((file) => file.id === activeSavedFileId)) {
      setActiveSavedFileId("");
    }
  }, [savedFiles, activeSavedFileId]);

  const activeSavedFile = useMemo(
    () => savedFiles.find((file) => file.id === activeSavedFileId) || null,
    [savedFiles, activeSavedFileId]
  );

  const quickSwitchFiles = useMemo(() => savedFiles.slice(0, 10), [savedFiles]);

  useEffect(() => {
    setRenameValue(activeSavedFile?.name || "");
  }, [activeSavedFile]);

  const upsertSavedFile = useCallback((entry) => {
    setSavedFiles((previous) => {
      const exists = previous.some((item) => item.id === entry.id);
      const next = exists
        ? previous.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...previous];

      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });
    setActiveSavedFileId(entry.id);
  }, []);

  const loadSavedFile = useCallback(
    (fileId) => {
      setActiveSavedFileId(fileId);
      const selectedFile = savedFiles.find((file) => file.id === fileId);
      if (!selectedFile) {
        return;
      }

      setFormat(selectedFile.format);
      setInput(selectedFile.input);
      setError("");
    },
    [savedFiles]
  );

  const saveCurrentDataset = useCallback(() => {
    const datasetName = `Dataset ${new Date().toLocaleString("nl-NL")}`;
    const entry = {
      id: `manual-${Date.now()}`,
      name: datasetName,
      format,
      input,
      updatedAt: Date.now()
    };

    upsertSavedFile(entry);
  }, [format, input, upsertSavedFile]);

  const deleteActiveSavedFile = useCallback(() => {
    if (!activeSavedFileId) {
      return;
    }

    setSavedFiles((previous) => previous.filter((file) => file.id !== activeSavedFileId));
    setActiveSavedFileId("");
  }, [activeSavedFileId]);

  const renameActiveSavedFile = useCallback(() => {
    const nextName = renameValue.trim();
    if (!activeSavedFileId || !nextName) {
      return;
    }

    setSavedFiles((previous) =>
      previous.map((file) =>
        file.id === activeSavedFileId
          ? {
              ...file,
              name: nextName,
              updatedAt: Date.now()
            }
          : file
      )
    );
  }, [activeSavedFileId, renameValue]);

  const exportSavedFiles = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      files: savedFiles
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `connection-overview-saved-files-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [savedFiles]);

  const onImportSavedFiles = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result || "{}"));
        const incoming = Array.isArray(imported)
          ? imported
          : Array.isArray(imported.files)
            ? imported.files
            : null;

        if (!incoming) {
          throw new Error("Ongeldig importbestand");
        }

        const normalized = incoming
          .map((entry) => ({
            id: String(entry.id || `import-${Date.now()}-${Math.random().toString(36).slice(2)}`),
            name: String(entry.name || "Naamloos bestand"),
            format: entry.format === "csv" ? "csv" : "yaml",
            input: String(entry.input || ""),
            updatedAt: Number(entry.updatedAt) || Date.now()
          }))
          .filter((entry) => entry.input);

        if (!normalized.length) {
          throw new Error("Geen bruikbare datasets gevonden");
        }

        setSavedFiles((previous) => {
          const map = new Map(previous.map((item) => [item.id, item]));
          normalized.forEach((item) => {
            map.set(item.id, item);
          });
          return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        });

        setError("");
      } catch {
        setError("Import mislukt: controleer het JSON-bestand.");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }, []);

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

  const hostingOptions = useMemo(() => {
    const options = new Set();
    graph.nodes.forEach((node) => {
      (node.data?.types || []).forEach((type) => options.add(type));
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [graph.nodes]);

  const connectionTypeOptions = useMemo(() => {
    const options = new Set(graph.edges.map((edge) => edge.label));
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [graph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    applyElkLayout(graph.nodes, graph.edges).then(({ nodes: ln, edges: le }) => {
      setNodes(ln);
      setEdges(le);
    });
    setSelectedNodeId(null);
  }, [graph, setEdges, setNodes]);

  const activeHostings = selectedHostings ?? hostingOptions;
  const activeConnectionTypes = selectedConnectionTypes ?? connectionTypeOptions;

  const filteredSets = useMemo(() => {
    const activeHostingsSet = new Set(activeHostings);
    const activeConnectionTypesSet = new Set(activeConnectionTypes);
    const hostingMatchedAppIds = new Set();
    const isAnyFilterActive = selectedHostings !== null || selectedConnectionTypes !== null;

    nodes.forEach((node) => {
      if (node.type !== "appNode") {
        return;
      }

      const types = node.data?.types || [];
      const matchesHosting = types.some((type) => activeHostingsSet.has(type));
      if (matchesHosting) {
        hostingMatchedAppIds.add(node.id);
      }
    });

    const visibleEdgeIds = new Set();
    edges.forEach((edge) => {
      const matchesConnectionType = activeConnectionTypesSet.has(edge.label);
      const endpointsVisible =
        hostingMatchedAppIds.has(edge.source) && hostingMatchedAppIds.has(edge.target);

      if (matchesConnectionType && endpointsVisible) {
        visibleEdgeIds.add(edge.id);
      }
    });

    const visibleAppIds = new Set(hostingMatchedAppIds);
    if (isAnyFilterActive) {
      const edgeConnectedAppIds = new Set();

      edges.forEach((edge) => {
        if (visibleEdgeIds.has(edge.id)) {
          edgeConnectedAppIds.add(edge.source);
          edgeConnectedAppIds.add(edge.target);
        }
      });

      visibleAppIds.forEach((appId) => {
        if (!edgeConnectedAppIds.has(appId)) {
          visibleAppIds.delete(appId);
        }
      });
    }

    const visibleGroupIds = new Set();
    nodes.forEach((node) => {
      if (node.type === "appNode" && visibleAppIds.has(node.id) && node.parentNode) {
        visibleGroupIds.add(node.parentNode);
      }
    });

    return {
      visibleAppIds,
      visibleEdgeIds,
      visibleGroupIds
    };
  }, [nodes, edges, activeHostings, activeConnectionTypes, selectedHostings, selectedConnectionTypes]);

  const visibleEdgeList = useMemo(
    () => edges.filter((edge) => filteredSets.visibleEdgeIds.has(edge.id)),
    [edges, filteredSets.visibleEdgeIds]
  );

  useEffect(() => {
    if (selectedNodeId && !filteredSets.visibleAppIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, filteredSets.visibleAppIds]);

  const selectedCluster = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }

    return getConnectedNodeIds(selectedNodeId, visibleEdgeList);
  }, [selectedNodeId, visibleEdgeList]);

  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const isAppNode = node.type === "appNode";
      const isVisible = isAppNode
        ? filteredSets.visibleAppIds.has(node.id)
        : filteredSets.visibleGroupIds.has(node.id);
      const isInFocus = !selectedCluster || !isAppNode || selectedCluster.has(node.id);
      const isSelected = node.id === selectedNodeId;

      return {
        ...node,
        hidden: !isVisible,
        style: {
          ...node.style,
          opacity: isInFocus ? 1 : 0.2,
          boxShadow: isSelected ? "0 0 0 3px rgba(15, 118, 110, 0.28)" : "none"
        }
      };
    });
  }, [nodes, selectedCluster, selectedNodeId, filteredSets.visibleAppIds, filteredSets.visibleGroupIds]);

  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      const isVisible = filteredSets.visibleEdgeIds.has(edge.id);
      const isInFocus =
        !selectedCluster || (selectedCluster.has(edge.source) && selectedCluster.has(edge.target));

      return {
        ...edge,
        hidden: !isVisible,
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
  }, [edges, selectedCluster, filteredSets.visibleEdgeIds]);

  const toggleHostingFilter = useCallback(
    (value) => {
      setSelectedHostings((previous) => {
        const base = previous ?? hostingOptions;
        const next = base.includes(value)
          ? base.filter((item) => item !== value)
          : [...base, value];

        return next.length === hostingOptions.length ? null : next;
      });
    },
    [hostingOptions]
  );

  const toggleConnectionTypeFilter = useCallback(
    (value) => {
      setSelectedConnectionTypes((previous) => {
        const base = previous ?? connectionTypeOptions;
        const next = base.includes(value)
          ? base.filter((item) => item !== value)
          : [...base, value];

        return next.length === connectionTypeOptions.length ? null : next;
      });
    },
    [connectionTypeOptions]
  );

  const resetFilters = useCallback(() => {
    setSelectedHostings(null);
    setSelectedConnectionTypes(null);
  }, []);

  const handleNodeClick = useCallback(
    (_, node) => {
      setSelectedNodeId(node.id);
      const connected = getConnectedNodeIds(node.id, visibleEdgeList);

      if (reactFlowInstance && connected.size) {
        reactFlowInstance.fitView({
          nodes: Array.from(connected).map((id) => ({ id })),
          padding: 0.25,
          duration: 350
        });
      }
    },
    [reactFlowInstance, visibleEdgeList]
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
    const nextFormat = formatFromFileName(file.name, format);

    setFormat(nextFormat);
    setInput(text);

    upsertSavedFile({
      id: `upload-${file.name.toLowerCase()}`,
      name: file.name,
      format: nextFormat,
      input: text,
      updatedAt: Date.now()
    });
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
        <div className="left-column">
          <section className={`panel left-panel ${isUploadCollapsed ? "collapsed" : ""}`}>
            <div className="panel-header">
              <h2>Data Input</h2>
              <div className="panel-header-actions">
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
                <button
                  type="button"
                  className="collapse-btn"
                  onClick={() => setIsHelpOpen((value) => !value)}
                  aria-label={isHelpOpen ? "Sluit invoerhulp" : "Open invoerhulp"}
                  title={isHelpOpen ? "Sluit invoerhulp" : "Open invoerhulp"}
                >
                  ?
                </button>
                <button
                  type="button"
                  className="collapse-btn"
                  onClick={() => setIsUploadCollapsed((value) => !value)}
                  aria-label={isUploadCollapsed ? "Open invoerpaneel" : "Sluit invoerpaneel"}
                  title={isUploadCollapsed ? "Open invoerpaneel" : "Sluit invoerpaneel"}
                >
                  {isUploadCollapsed ? "▾" : "▴"}
                </button>
              </div>
            </div>

            {isHelpOpen ? (
              <div className="input-help" role="note" aria-label="Invoerhulp">
                <p className="help-title">Input bestand opties</p>
                <p className="hint">Ondersteund: CSV, YAML (.yaml, .yml). Gebruik 1 record per regel/object.</p>
                <p className="help-subtitle">Minimaal benodigd</p>
                <ul>
                  <li>Bronapplicatie (of Source, Source Application, From)</li>
                  <li>Doelapplicatie (of Target, Target Application, To)</li>
                </ul>
                <p className="help-subtitle">Optionele velden</p>
                <ul>
                  <li>Bron type: Brontype, Bron type, Source hosting</li>
                  <li>Doel type: Doeltype, Doel type, Target hosting</li>
                  <li>Bron opmerking: Bronopmerking, Source comment, Source remark</li>
                  <li>Doel opmerking: Doelopmerking, Target comment, Target remark</li>
                  <li>Koppelingsoort: Koppelingsoort, Soort koppeling, Connection type, Integration type</li>
                </ul>
              </div>
            ) : null}

            {!isUploadCollapsed ? (
              <>
                <div className="format-row">
                  <label>
                    Formaat
                    <select value={format} onChange={(e) => setFormat(e.target.value)}>
                      <option value="yaml">YAML</option>
                      <option value="csv">CSV</option>
                    </select>
                  </label>
                </div>

                <div className="saved-row">
                  <label>
                    Opgeslagen bestanden
                    <select
                      value={activeSavedFileId}
                      onChange={(e) => loadSavedFile(e.target.value)}
                    >
                      <option value="">Kies een opgeslagen bestand</option>
                      {savedFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name} ({file.format.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="quick-switch-row" role="group" aria-label="Snel wisselen van datasets">
                    {quickSwitchFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`quick-file-btn ${activeSavedFileId === file.id ? "active" : ""}`}
                        onClick={() => loadSavedFile(file.id)}
                        title={`Laad ${file.name}`}
                      >
                        {file.name}
                      </button>
                    ))}
                  </div>
                  <div className="saved-rename-row">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Nieuwe naam voor selectie"
                      disabled={!activeSavedFileId}
                    />
                    <button
                      type="button"
                      onClick={renameActiveSavedFile}
                      disabled={!activeSavedFileId || !renameValue.trim()}
                    >
                      Hernoem
                    </button>
                  </div>
                  <div className="saved-actions">
                    <button type="button" onClick={saveCurrentDataset}>Opslaan huidige</button>
                    <button
                      type="button"
                      onClick={deleteActiveSavedFile}
                      disabled={!activeSavedFileId}
                    >
                      Verwijder
                    </button>
                  </div>
                  <div className="saved-actions">
                    <button
                      type="button"
                      onClick={exportSavedFiles}
                      disabled={!savedFiles.length}
                    >
                      Exporteer
                    </button>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                    >
                      Importeer
                    </button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={onImportSavedFiles}
                      className="hidden-input"
                    />
                  </div>
                </div>
                <span className="hint">Geuploade bestanden worden automatisch opgeslagen in je browser.</span>

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
              </>
            ) : (
              <>
                <p className="meta">Paneel ingeklapt. Gebruik "Bestand kiezen" of klik hieronder om te wisselen.</p>
                {quickSwitchFiles.length ? (
                  <div className="quick-switch-row" role="group" aria-label="Snel wisselen van datasets">
                    {quickSwitchFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`quick-file-btn ${activeSavedFileId === file.id ? "active" : ""}`}
                        onClick={() => loadSavedFile(file.id)}
                        title={`Laad ${file.name}`}
                      >
                        {file.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="panel filter-panel">
            <div className="panel-header">
              <h2>Filters</h2>
              <button type="button" onClick={resetFilters}>Reset</button>
            </div>

            <div className="filter-group">
              <p className="filter-title">Hosting</p>
              <div className="filter-badges">
                {hostingOptions.map((option) => {
                  const active = activeHostings.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`filter-badge ${active ? "active" : ""}`}
                      onClick={() => toggleHostingFilter(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="filter-group">
              <p className="filter-title">Koppelingsoort</p>
              <div className="filter-badges">
                {connectionTypeOptions.map((option) => {
                  const active = activeConnectionTypes.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`filter-badge ${active ? "active" : ""}`}
                      onClick={() => toggleConnectionTypeFilter(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="meta">
              Zichtbaar: {filteredSets.visibleAppIds.size}/{nodes.filter((node) => node.type === "appNode").length} applicaties,
              {" "}{filteredSets.visibleEdgeIds.size}/{edges.length} koppelingen
            </p>
          </section>
        </div>

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
