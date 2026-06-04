import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  getBezierPath,
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
const ACTIVE_SAVED_FILE_STORAGE_KEY = "connection-overview.active-file-id.v1";
const LANGUAGE_STORAGE_KEY = "connection-overview.language.v1";

const TRANSLATIONS = {
  nl: {
    languageName: "Nederlands",
    locale: "nl-NL",
    datasetPrefix: "Dataset",
    unnamedFile: "Naamloos bestand",
    titleTagline: "Visualiseer applicatiekoppelingen uit CSV of YAML met React Flow.",
    switchMode: "Schakel naar {mode} modus",
    lightMode: "lichte",
    darkMode: "donkere",
    languageLabel: "Taal",
    dataInput: "Data Input",
    chooseFile: "Bestand kiezen",
    closeInputHelp: "Sluit invoerhulp",
    openInputHelp: "Open invoerhulp",
    openInputPanel: "Open invoerpaneel",
    closeInputPanel: "Sluit invoerpaneel",
    inputHelpAria: "Invoerhulp",
    inputFileOptions: "Input bestand opties",
    supportedFormats: "Ondersteund: CSV, YAML (.yaml, .yml). Gebruik 1 record per regel/object.",
    minimumRequired: "Minimaal benodigd",
    optionalFields: "Optionele velden",
    sourceApplicationField: "Bronapplicatie (of Source, Source Application, From)",
    targetApplicationField: "Doelapplicatie (of Target, Target Application, To)",
    sourceTypeField: "Bron type: Brontype, Bron type, Source hosting",
    targetTypeField: "Doel type: Doeltype, Doel type, Target hosting",
    sourceRemarkField: "Bron opmerking: Bronopmerking, Source comment, Source remark",
    targetRemarkField: "Doel opmerking: Doelopmerking, Target comment, Target remark",
    connectionTypeField: "Koppelingsoort: Koppelingsoort, Soort koppeling, Connection type, Integration type",
    integrationSolutionField: "Integratieoplossing: Integration solution, Integratie oplossing",
    format: "Formaat",
    savedFiles: "Opgeslagen bestanden",
    chooseSavedFile: "Kies een opgeslagen bestand",
    quickDatasetSwitch: "Snel wisselen van datasets",
    loadFileTitle: "Laad {name}",
    renamePlaceholder: "Nieuwe naam voor selectie",
    rename: "Hernoem",
    saveCurrent: "Opslaan huidige",
    delete: "Verwijder",
    export: "Exporteer",
    import: "Importeer",
    browserSavedHint: "Geuploade bestanden worden automatisch opgeslagen in je browser.",
    dragNodes: "Nodes verslepen",
    focusHint: "Klik op een node om verbonden onderdelen te focussen.",
    recordsCount: "Records: {count}",
    collapsedPanelHint: "Paneel ingeklapt. Gebruik \"Bestand kiezen\" of klik hieronder om te wisselen.",
    filters: "Filters",
    reset: "Reset",
    hosting: "Hosting",
    connectionType: "Koppelingsoort",
    visibleSummary: "Zichtbaar: {appsVisible}/{appsTotal} applicaties, {edgesVisible}/{edgesTotal} koppelingen",
    legend: "Legenda",
    unknown: "Onbekend",
    tableView: "Tabelweergave",
    tableAriaLabel: "Tabelweergave van ingevoerde records",
    addRowTitle: "Voeg een lege rij toe",
    addRow: "+ Rij",
    downloadCsvTitle: "Download als CSV",
    rowsCount: "Rijen: {count}",
    actions: "Acties",
    deleteRow: "Verwijder rij",
    noRecords: "Geen records. Upload een bestand of voeg rijen toe.",
    source: "Bron",
    target: "Doel",
    sourceApplication: "Bronapplicatie",
    targetApplication: "Doelapplicatie",
    sourceType: "Brontype",
    targetType: "Doeltype",
    sourceRemark: "Bronopmerking",
    targetRemark: "Doelopmerking",
    integrationSolution: "Integratieoplossing",
    importInvalidFile: "Ongeldig importbestand",
    importNoDatasets: "Geen bruikbare datasets gevonden",
    importFailed: "Import mislukt: controleer het JSON-bestand.",
    failedToParseData: "Data kon niet worden ingelezen.",
    csvParseError: "CSV parsefout op rij {row}: {message}",
    yamlListError: "YAML moet een lijst met records bevatten.",
    unsupportedFormat: "Niet-ondersteund formaat: {format}",
    exportFileName: "export",
    hostingFallback: "Onbekend",
    connectionFallback: "Onbekend"
  },
  en: {
    languageName: "English",
    locale: "en-US",
    datasetPrefix: "Dataset",
    unnamedFile: "Untitled file",
    titleTagline: "Visualize application connections from CSV or YAML with React Flow.",
    switchMode: "Switch to {mode} mode",
    lightMode: "light",
    darkMode: "dark",
    languageLabel: "Language",
    dataInput: "Data Input",
    chooseFile: "Choose file",
    closeInputHelp: "Close input help",
    openInputHelp: "Open input help",
    openInputPanel: "Open input panel",
    closeInputPanel: "Close input panel",
    inputHelpAria: "Input help",
    inputFileOptions: "Input file options",
    supportedFormats: "Supported: CSV, YAML (.yaml, .yml). Use 1 record per line/object.",
    minimumRequired: "Minimum required",
    optionalFields: "Optional fields",
    sourceApplicationField: "Source application (or Source, Source Application, From)",
    targetApplicationField: "Target application (or Target, Target Application, To)",
    sourceTypeField: "Source type: Brontype, Bron type, Source hosting",
    targetTypeField: "Target type: Doeltype, Doel type, Target hosting",
    sourceRemarkField: "Source remark: Bronopmerking, Source comment, Source remark",
    targetRemarkField: "Target remark: Doelopmerking, Target comment, Target remark",
    connectionTypeField: "Connection type: Koppelingsoort, Soort koppeling, Connection type, Integration type",
    integrationSolutionField: "Integration solution: Integration solution, Integratie oplossing",
    format: "Format",
    savedFiles: "Saved files",
    chooseSavedFile: "Choose a saved file",
    quickDatasetSwitch: "Quick dataset switch",
    loadFileTitle: "Load {name}",
    renamePlaceholder: "New name for selection",
    rename: "Rename",
    saveCurrent: "Save current",
    delete: "Delete",
    export: "Export",
    import: "Import",
    browserSavedHint: "Uploaded files are automatically saved in your browser.",
    dragNodes: "Drag nodes",
    focusHint: "Click a node to focus connected parts.",
    recordsCount: "Records: {count}",
    collapsedPanelHint: "Panel collapsed. Use \"Choose file\" or click below to switch.",
    filters: "Filters",
    reset: "Reset",
    hosting: "Hosting",
    connectionType: "Connection type",
    visibleSummary: "Visible: {appsVisible}/{appsTotal} applications, {edgesVisible}/{edgesTotal} connections",
    legend: "Legend",
    unknown: "Unknown",
    tableView: "Table View",
    tableAriaLabel: "Table view of imported records",
    addRowTitle: "Add an empty row",
    addRow: "+ Row",
    downloadCsvTitle: "Download as CSV",
    rowsCount: "Rows: {count}",
    actions: "Actions",
    deleteRow: "Delete row",
    noRecords: "No records. Upload a file or add rows.",
    source: "Source",
    target: "Target",
    sourceApplication: "Source application",
    targetApplication: "Target application",
    sourceType: "Source type",
    targetType: "Target type",
    sourceRemark: "Source remark",
    targetRemark: "Target remark",
    integrationSolution: "Integration solution",
    importInvalidFile: "Invalid import file",
    importNoDatasets: "No usable datasets found",
    importFailed: "Import failed: check the JSON file.",
    failedToParseData: "Failed to parse data.",
    csvParseError: "CSV parse error on row {row}: {message}",
    yamlListError: "YAML should contain a list of records.",
    unsupportedFormat: "Unsupported format: {format}",
    exportFileName: "export",
    hostingFallback: "Unknown",
    connectionFallback: "Unknown"
  }
};

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && TRANSLATIONS[saved]) {
      return saved;
    }
  } catch {
    return "en";
  }

  return navigator.language?.toLowerCase().startsWith("nl") ? "nl" : "en";
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function getTableColumns(t) {
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
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function RemarkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });
  const sourceLabel = data?.sourceLabel || "Source";
  const targetLabel = data?.targetLabel || "Target";
  const tooltipLines = [
    `${sourceLabel}: ${data?.sourceRemark || "-"}`,
    `${targetLabel}: ${data?.targetRemark || "-"}`
  ];

  if (data?.integrationSolution) {
    tooltipLines.push(`Integration solution: ${data.integrationSolution}`);
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        pointerEvents="stroke"
      >
        <title>{tooltipLines.join("\n")}</title>
      </path>
    </>
  );
}

const nodeTypes = { appNode: NodeLabel };
const edgeTypes = { remarkEdge: RemarkEdge };

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
  const [language, setLanguage] = useState(getInitialLanguage);
  const [format, setFormat] = useState("yaml");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [savedFiles, setSavedFiles] = useState([]);
  const [activeSavedFileId, setActiveSavedFileId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_SAVED_FILE_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [hasLoadedSavedFiles, setHasLoadedSavedFiles] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isUploadCollapsed, setIsUploadCollapsed] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedHostings, setSelectedHostings] = useState(null);
  const [selectedConnectionTypes, setSelectedConnectionTypes] = useState(null);
  const importInputRef = useRef(null);
  const tableBodyRef = useRef(null);
  const [editedRows, setEditedRows] = useState([]);
  const { theme, toggle: toggleTheme } = useTheme();
  const messages = TRANSLATIONS[language] || TRANSLATIONS.en;
  const t = useCallback(
    (key, values) => interpolate(messages[key] ?? TRANSLATIONS.en[key] ?? key, values),
    [messages]
  );
  const tableColumns = useMemo(() => getTableColumns(t), [t]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_FILES_STORAGE_KEY);
      if (!raw) {
        setHasLoadedSavedFiles(true);
        return;
      }

      const parsedFiles = JSON.parse(raw);
      if (!Array.isArray(parsedFiles)) {
        setHasLoadedSavedFiles(true);
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

      const storedActiveId = localStorage.getItem(ACTIVE_SAVED_FILE_STORAGE_KEY) || "";
      const restoredActiveFile =
        normalized.find((entry) => entry.id === storedActiveId) || normalized[0] || null;

      if (restoredActiveFile) {
        setActiveSavedFileId(restoredActiveFile.id);
        setFormat(restoredActiveFile.format);
        setInput(restoredActiveFile.input);
      }
    } catch {
      setSavedFiles([]);
    } finally {
      setHasLoadedSavedFiles(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedFiles) {
      return;
    }
    localStorage.setItem(SAVED_FILES_STORAGE_KEY, JSON.stringify(savedFiles));
  }, [savedFiles, hasLoadedSavedFiles]);

  useEffect(() => {
    if (!hasLoadedSavedFiles) {
      return;
    }

    if (activeSavedFileId) {
      localStorage.setItem(ACTIVE_SAVED_FILE_STORAGE_KEY, activeSavedFileId);
      return;
    }

    localStorage.removeItem(ACTIVE_SAVED_FILE_STORAGE_KEY);
  }, [activeSavedFileId, hasLoadedSavedFiles]);

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
    const datasetName = `${t("datasetPrefix")} ${new Date().toLocaleString(messages.locale)}`;
    const entry = {
      id: `manual-${Date.now()}`,
      name: datasetName,
      format,
      input,
      updatedAt: Date.now()
    };

    upsertSavedFile(entry);
  }, [format, input, upsertSavedFile, t, messages.locale]);

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
          throw new Error(t("importInvalidFile"));
        }

        const normalized = incoming
          .map((entry) => ({
            id: String(entry.id || `import-${Date.now()}-${Math.random().toString(36).slice(2)}`),
            name: String(entry.name || t("unnamedFile")),
            format: entry.format === "csv" ? "csv" : "yaml",
            input: String(entry.input || ""),
            updatedAt: Number(entry.updatedAt) || Date.now()
          }))
          .filter((entry) => entry.input);

        if (!normalized.length) {
          throw new Error(t("importNoDatasets"));
        }

        setSavedFiles((previous) => {
          const map = new Map(previous.map((item) => [item.id, item]));
          normalized.forEach((item) => {
            map.set(item.id, item);
          });
          return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        });

        setError("");
      } catch (err) {
        setError(err.message || t("importFailed"));
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }, [t]);

  const parsed = useMemo(() => {
    try {
      const rows = parseByFormat(input, format, {
        csvParseError: ({ row, message }) => t("csvParseError", { row, message }),
        yamlExpectedList: t("yamlListError"),
        unsupportedFormat: (nextFormat) => t("unsupportedFormat", { format: nextFormat })
      });
      setError("");
      return rows;
    } catch (err) {
      setError(err.message || t("failedToParseData"));
      return [];
    }
  }, [input, format, t]);

  useEffect(() => {
    setEditedRows(parsed);
  }, [parsed]);

  const graph = useMemo(
    () =>
      buildGraph(editedRows, {
        hostingFallback: t("hostingFallback"),
        connectionFallback: t("connectionFallback")
      }),
    [editedRows, t]
  );

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
        data: isAppNode
          ? {
              ...node.data,
              sourceLabel: t("source"),
              targetLabel: t("target")
            }
          : node.data,
        hidden: !isVisible,
        style: {
          ...node.style,
          opacity: isInFocus ? 1 : 0.2,
          boxShadow: isSelected ? "0 0 0 3px rgba(15, 118, 110, 0.28)" : "none"
        }
      };
    });
  }, [nodes, selectedCluster, selectedNodeId, filteredSets.visibleAppIds, filteredSets.visibleGroupIds, t]);

  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      const isVisible = filteredSets.visibleEdgeIds.has(edge.id);
      const isInFocus =
        !selectedCluster || (selectedCluster.has(edge.source) && selectedCluster.has(edge.target));

      return {
        ...edge,
        data: {
          ...edge.data,
          sourceLabel: t("source"),
          targetLabel: t("target")
        },
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
  }, [edges, selectedCluster, filteredSets.visibleEdgeIds, t]);

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

  const updateCell = useCallback((rowIndex, key, value) => {
    setEditedRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
  }, []);

  const deleteRow = useCallback((rowIndex) => {
    setEditedRows((prev) => prev.filter((_, i) => i !== rowIndex));
  }, []);

  const addRow = useCallback(() => {
    setEditedRows((prev) => [
      ...prev,
      {
        bronapplicatie: "",
        doelapplicatie: "",
        bronHosting: "",
        doelHosting: "",
        koppelingSoort: "",
        integratieOplossing: "",
        bronOpmerking: "",
        doelOpmerking: ""
      }
    ]);
  }, []);

  const downloadEditedCSV = useCallback(() => {
    const headers = tableColumns.map((c) => c.label);
    const escape = (val) => {
      const s = String(val || "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      headers.join(","),
      ...editedRows.map((row) => tableColumns.map((col) => escape(row[col.key])).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(activeSavedFile?.name || t("exportFileName")).replace(/\.[^.]+$/, "")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [tableColumns, editedRows, activeSavedFile, t]);

  const handleRowClick = useCallback(
    (record) => {
      const nodeId = record.bronapplicatie;
      if (!nodeId) return;
      setSelectedNodeId(nodeId);
      if (!filteredSets.visibleAppIds.has(nodeId)) return;
      const connected = getConnectedNodeIds(nodeId, visibleEdgeList);
      if (reactFlowInstance && connected.size) {
        reactFlowInstance.fitView({
          nodes: Array.from(connected).map((id) => ({ id })),
          padding: 0.25,
          duration: 350
        });
      }
    },
    [reactFlowInstance, visibleEdgeList, filteredSets]
  );

  useEffect(() => {
    if (!selectedNodeId || !tableBodyRef.current) return;
    const firstMatchIndex = editedRows.findIndex(
      (r) => r.bronapplicatie === selectedNodeId || r.doelapplicatie === selectedNodeId
    );
    if (firstMatchIndex !== -1) {
      const rowElements = tableBodyRef.current.querySelectorAll("tr");
      rowElements[firstMatchIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedNodeId, editedRows]);

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
          <p>{t("titleTagline")}</p>
        </div>
        <div className="topbar-actions">
          <label className="language-select">
            <span>{t("languageLabel")}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {Object.entries(TRANSLATIONS).map(([code, translation]) => (
                <option key={code} value={code}>
                  {translation.languageName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={t("switchMode", {
              mode: theme === "dark" ? t("lightMode") : t("darkMode")
            })}
            title={t("switchMode", {
              mode: theme === "dark" ? t("lightMode") : t("darkMode")
            })}
          >
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="left-column">
          <section className={`panel left-panel ${isUploadCollapsed ? "collapsed" : ""}`}>
            <div className="panel-header">
              <h2>{t("dataInput")}</h2>
              <div className="panel-header-actions">
                <label className="file-btn">
                  {t("chooseFile")}
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
                  aria-label={isHelpOpen ? t("closeInputHelp") : t("openInputHelp")}
                  title={isHelpOpen ? t("closeInputHelp") : t("openInputHelp")}
                >
                  ?
                </button>
                <button
                  type="button"
                  className="collapse-btn"
                  onClick={() => setIsUploadCollapsed((value) => !value)}
                  aria-label={isUploadCollapsed ? t("openInputPanel") : t("closeInputPanel")}
                  title={isUploadCollapsed ? t("openInputPanel") : t("closeInputPanel")}
                >
                  {isUploadCollapsed ? "▾" : "▴"}
                </button>
              </div>
            </div>

            {isHelpOpen ? (
              <div className="input-help" role="note" aria-label={t("inputHelpAria")}>
                <p className="help-title">{t("inputFileOptions")}</p>
                <p className="hint">{t("supportedFormats")}</p>
                <p className="help-subtitle">{t("minimumRequired")}</p>
                <ul>
                  <li>{t("sourceApplicationField")}</li>
                  <li>{t("targetApplicationField")}</li>
                </ul>
                <p className="help-subtitle">{t("optionalFields")}</p>
                <ul>
                  <li>{t("sourceTypeField")}</li>
                  <li>{t("targetTypeField")}</li>
                  <li>{t("sourceRemarkField")}</li>
                  <li>{t("targetRemarkField")}</li>
                  <li>{t("connectionTypeField")}</li>
                  <li>{t("integrationSolutionField")}</li>
                </ul>
              </div>
            ) : null}

            {!isUploadCollapsed ? (
              <>
                <div className="format-row">
                  <label>
                    {t("format")}
                    <select value={format} onChange={(e) => setFormat(e.target.value)}>
                      <option value="yaml">YAML</option>
                      <option value="csv">CSV</option>
                    </select>
                  </label>
                </div>

                <div className="saved-row">
                  <label>
                    {t("savedFiles")}
                    <select
                      value={activeSavedFileId}
                      onChange={(e) => loadSavedFile(e.target.value)}
                    >
                      <option value="">{t("chooseSavedFile")}</option>
                      {savedFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.name} ({file.format.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="quick-switch-row" role="group" aria-label={t("quickDatasetSwitch")}>
                    {quickSwitchFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`quick-file-btn ${activeSavedFileId === file.id ? "active" : ""}`}
                        onClick={() => loadSavedFile(file.id)}
                        title={t("loadFileTitle", { name: file.name })}
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
                      placeholder={t("renamePlaceholder")}
                      disabled={!activeSavedFileId}
                    />
                    <button
                      type="button"
                      className="saved-action-btn compact"
                      onClick={renameActiveSavedFile}
                      disabled={!activeSavedFileId || !renameValue.trim()}
                    >
                      <span className="saved-action-icon" aria-hidden="true">✎</span>
                      {t("rename")}
                    </button>
                  </div>
                  <div className="saved-actions">
                    <button type="button" className="saved-action-btn" onClick={saveCurrentDataset}>
                      <span className="saved-action-icon" aria-hidden="true">＋</span>
                      {t("saveCurrent")}
                    </button>
                    <button
                      type="button"
                      className="saved-action-btn"
                      onClick={deleteActiveSavedFile}
                      disabled={!activeSavedFileId}
                    >
                      <span className="saved-action-icon" aria-hidden="true">×</span>
                      {t("delete")}
                    </button>
                  </div>
                  <div className="saved-actions">
                    <button
                      type="button"
                      className="saved-action-btn"
                      onClick={exportSavedFiles}
                      disabled={!savedFiles.length}
                    >
                      <span className="saved-action-icon" aria-hidden="true">↥</span>
                      {t("export")}
                    </button>
                    <button
                      type="button"
                      className="saved-action-btn"
                      onClick={() => importInputRef.current?.click()}
                    >
                      <span className="saved-action-icon" aria-hidden="true">↧</span>
                      {t("import")}
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
                <span className="hint">{t("browserSavedHint")}</span>

                <div className="options-row">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={dragEnabled}
                      onChange={(e) => setDragEnabled(e.target.checked)}
                    />
                    {t("dragNodes")}
                  </label>
                  <span className="hint">{t("focusHint")}</span>
                </div>

                {error ? <p className="error">{error}</p> : null}
                <p className="meta">{t("recordsCount", { count: editedRows.length })}</p>
              </>
            ) : (
              <>
                <p className="meta">{t("collapsedPanelHint")}</p>
                {quickSwitchFiles.length ? (
                  <div className="quick-switch-row" role="group" aria-label={t("quickDatasetSwitch")}>
                    {quickSwitchFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`quick-file-btn ${activeSavedFileId === file.id ? "active" : ""}`}
                        onClick={() => loadSavedFile(file.id)}
                        title={t("loadFileTitle", { name: file.name })}
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
              <h2>{t("filters")}</h2>
              <button type="button" onClick={resetFilters}>{t("reset")}</button>
            </div>

            <div className="filter-group">
              <p className="filter-title">{t("hosting")}</p>
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
              <p className="filter-title">{t("connectionType")}</p>
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
              {t("visibleSummary", {
                appsVisible: filteredSets.visibleAppIds.size,
                appsTotal: nodes.filter((node) => node.type === "appNode").length,
                edgesVisible: filteredSets.visibleEdgeIds.size,
                edgesTotal: edges.length
              })}
            </p>
          </section>
        </div>

        <div className="right-column">
          <section className="panel flow-panel">
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
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
                <strong>{t("legend")}</strong>
                <span>
                  <i className="dot saas" /> SaaS
                </span>
                <span>
                  <i className="dot onprem" /> On-premises
                </span>
                <span>
                  <i className="dot unknown" /> {t("unknown")}
                </span>
              </Panel>
            </ReactFlow>
          </section>

          <section className="panel table-panel" aria-label={t("tableAriaLabel")}>
            <div className="panel-header">
              <h2>{t("tableView")}</h2>
              <div className="panel-header-actions">
                <button type="button" onClick={addRow} title={t("addRowTitle")}>
                  {t("addRow")}
                </button>
                <button
                  type="button"
                  onClick={downloadEditedCSV}
                  disabled={!editedRows.length}
                  title={t("downloadCsvTitle")}
                >
                  ↓ CSV
                </button>
                <p className="meta">{t("rowsCount", { count: editedRows.length })}</p>
              </div>
            </div>

            {editedRows.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      {tableColumns.map((column) => (
                        <th key={column.key} scope="col">
                          {column.label}
                        </th>
                      ))}
                      <th scope="col" aria-label={t("actions")} />
                    </tr>
                  </thead>
                  <tbody ref={tableBodyRef}>
                    {editedRows.map((record, index) => {
                      const isHighlighted =
                        selectedNodeId &&
                        (record.bronapplicatie === selectedNodeId ||
                          record.doelapplicatie === selectedNodeId);
                      return (
                        <tr
                          key={index}
                          className={isHighlighted ? "row-highlighted" : ""}
                          onClick={() => handleRowClick(record)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{index + 1}</td>
                          {tableColumns.map((column) => (
                            <td key={column.key}>
                              <input
                                className="table-cell-input"
                                value={record[column.key] || ""}
                                onChange={(e) => updateCell(index, column.key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              type="button"
                              className="row-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRow(index);
                              }}
                              aria-label={t("deleteRow")}
                              title={t("deleteRow")}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="meta">{t("noRecords")}</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
