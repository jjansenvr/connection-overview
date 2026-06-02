import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel
} from "reactflow";
import "reactflow/dist/style.css";

import { buildGraph } from "./graphBuilder";
import { parseByFormat } from "./parsers";
import sampleYaml from "./sample-data.yaml?raw";

const sampleCsv = `Bronapplicatie,Bronopmerking,Doelapplicatie,Doelopmerking,Brontype,Doeltype,Koppelingsoort
ERP,Stuurt orderdata door,CRM,Ontvangt orderdata,On premises,SaaS,API
CRM,Levert klantupdates,Datawarehouse,Verwerkt periodieke export,SaaS,On premises,Batch
HRM,Publiceert medewerker-events,ERP,Valideert medewerkers,SaaS,On premises,Event`;

function NodeLabel({ data }) {
  return (
    <div className="node-label">
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
    </div>
  );
}

const nodeTypes = { appNode: NodeLabel };

export default function App() {
  const [format, setFormat] = useState("yaml");
  const [input, setInput] = useState(sampleYaml);
  const [error, setError] = useState("");

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
        <h1>Connection Overview</h1>
        <p>Visualiseer applicatiekoppelingen uit CSV of YAML met React Flow.</p>
      </header>

      <main className="layout">
        <section className="panel left-panel">
          <div className="panel-header">
            <h2>Data Input</h2>
            <label className="file-btn">
              Bestand kiezen
              <input type="file" accept=".csv,.yaml,.yml,text/csv" onChange={onFileUpload} />
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
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
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
