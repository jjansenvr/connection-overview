import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const fitViewMock = vi.fn();

vi.mock("./graphBuilder", async () => {
  const actual = await vi.importActual<typeof import("./graphBuilder")>("./graphBuilder");

  return {
    ...actual,
    applyElkLayout: vi.fn(async (nodes, edges) => ({ nodes, edges }))
  };
});

vi.mock("reactflow", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const ReactFlow = ({ nodes, edges, onInit, onNodeClick, onEdgeClick, children }: any) => {
    React.useEffect(() => {
      onInit?.({ fitView: fitViewMock });
    }, [onInit]);

    return (
      <div data-testid="mock-reactflow">
        <button
          type="button"
          onClick={() => {
            const firstNode = nodes?.find((node: any) => node?.type === "appNode");
            if (firstNode) {
              onNodeClick?.({}, firstNode);
            }
          }}
        >
          trigger-node-click
        </button>
        <button
          type="button"
          onClick={() => {
            const firstEdge = edges?.[0];
            if (firstEdge) {
              onEdgeClick?.({}, firstEdge);
            }
          }}
        >
          trigger-edge-click
        </button>
        {children}
      </div>
    );
  };

  return {
    __esModule: true,
    default: ReactFlow,
    Background: () => null,
    BaseEdge: () => null,
    Controls: () => null,
    Handle: () => null,
    MiniMap: () => null,
    Panel: ({ children }: any) => <div>{children}</div>,
    Position: { Left: "left", Right: "right" },
    MarkerType: { ArrowClosed: "arrow-closed" },
    getBezierPath: () => ["M 0 0", 0, 0],
    useNodesState: (initialNodes: any[] = []) => {
      const [nodes, setNodes] = React.useState(initialNodes);
      return [nodes, setNodes, vi.fn()];
    },
    useEdgesState: (initialEdges: any[] = []) => {
      const [edges, setEdges] = React.useState(initialEdges);
      return [edges, setEdges, vi.fn()];
    }
  };
});

const SAVED_FILES_STORAGE_KEY = "connection-overview.saved-files.v1";
const ACTIVE_SAVED_FILE_STORAGE_KEY = "connection-overview.active-file-id.v1";

function seedSavedDataset() {
  const input = JSON.stringify(
    [
      {
        bronapplicatie: "ERP",
        doelapplicatie: "CRM",
        bronHosting: "SaaS",
        doelHosting: "On premises",
        koppelingSoort: "API",
        integratieOplossing: "Mule",
        bronOpmerking: "Source note",
        doelOpmerking: "Target note"
      }
    ],
    null,
    2
  );

  const file = {
    id: "dataset-1",
    name: "Dataset 1",
    format: "yaml",
    input,
    updatedAt: Date.now()
  };

  localStorage.setItem(SAVED_FILES_STORAGE_KEY, JSON.stringify([file]));
  localStorage.setItem(ACTIVE_SAVED_FILE_STORAGE_KEY, file.id);
}

describe("App interaction and persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    fitViewMock.mockClear();
    seedSavedDataset();
  });

  it("keeps source and target type values when loading saved dataset", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("SaaS")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("On premises")).toBeInTheDocument();
  });

  it("keeps edited table fields after language switch reparses input", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Source note")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Source note"), {
      target: { value: "Updated source note" }
    });
    fireEvent.change(screen.getByDisplayValue("Target note"), {
      target: { value: "Updated target note" }
    });
    fireEvent.change(screen.getByDisplayValue("Mule"), {
      target: { value: "Boomi" }
    });

    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "nl" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Updated source note")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Updated target note")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Boomi")).toBeInTheDocument();
  });

  it("supports graph and table highlight both ways", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("ERP").length).toBeGreaterThan(0);
    });

    const bodyRow = container.querySelector("tbody tr") as HTMLTableRowElement;
    expect(bodyRow).toBeTruthy();

    fireEvent.click(bodyRow);

    await waitFor(() => {
      expect(bodyRow.className).toContain("row-highlighted");
    });

    expect(fitViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([{ id: "ERP" }, { id: "CRM" }])
      })
    );

    fireEvent.click(screen.getAllByRole("button", { name: "trigger-node-click" })[0]);

    await waitFor(() => {
      expect(bodyRow.className).toContain("row-highlighted");
    });

    fireEvent.click(screen.getAllByRole("button", { name: "trigger-edge-click" })[0]);

    await waitFor(() => {
      expect(bodyRow.className).toContain("row-highlighted");
    });

    const table = screen.getByRole("table");
    expect(within(table).getAllByDisplayValue("ERP").length).toBeGreaterThan(0);
  });
});
