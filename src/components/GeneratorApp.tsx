"use client";

import { useCallback, useState } from "react";
import { ComponentPreview } from "./ComponentPreview";
import { ComponentTreeView } from "./ComponentTreeView";
import { PreviewGenerating } from "./PreviewGenerating";
import { downloadViteProjectZip, openInStackBlitz } from "@/lib/export/stackblitz";
import type {
  AnalystOutput,
  ArchitectOutput,
  ThemeOutput,
} from "@/lib/agents/schemas";
import type { AgentId, PipelineEvent } from "@/lib/agents/pipeline";

const AGENT_LABEL: Record<AgentId, string> = {
  prd_analyst: "PRD Analyst",
  ux_planner: "UX Planner",
  design_agent: "Design System Agent",
  ui_generator: "UI Generator",
  qa_agent: "QA Agent",
};

const btnPrimary =
  "rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const btnGreen =
  "rounded-md bg-green-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50";
const btnBlueSoft =
  "rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const btnNeutral =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400";
const inputBase =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-blue-500";

async function readNdjsonStream(
  body: ReadableStream<Uint8Array> | null,
  onEvent: (event: PipelineEvent) => void,
): Promise<void> {
  if (!body) {
    throw new Error("Empty response body.");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as PipelineEvent;
      onEvent(parsed);
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as PipelineEvent);
  }
}

export function GeneratorApp() {
  const [prdText, setPrdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentId | null>(null);
  const [analyst, setAnalyst] = useState<AnalystOutput | null>(null);
  const [architect, setArchitect] = useState<ArchitectOutput | null>(null);
  const [theme, setTheme] = useState<ThemeOutput | null>(null);
  const [tsx, setTsx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [tailwindTarget, setTailwindTarget] = useState<"v4" | "v3">("v4");
  const [attemptText, setAttemptText] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [exportingStackBlitz, setExportingStackBlitz] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  const onFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".txt")) {
      setError("Please upload a .txt file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setPrdText(text);
      setError(null);
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsText(f);
  }, []);

  const appendActivity = useCallback((line: string) => {
    setActivityLog((prev) => [...prev, line]);
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    setTsx(null);
    setAnalyst(null);
    setArchitect(null);
    setTheme(null);
    setCopyDone(false);
    setLoading(true);
    setActiveAgent(null);
    setAttemptText(null);
    setFeedback(null);
    setActivityLog([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prdText, tailwindTarget }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }

      await readNdjsonStream(res.body, (event) => {
        if (event.type === "agent_start") {
          setActiveAgent(event.agent);
          appendActivity(`Started: ${AGENT_LABEL[event.agent]}`);
        } else if (event.type === "agent_complete") {
          appendActivity(`Completed: ${AGENT_LABEL[event.agent]}`);
          if (event.agent === "prd_analyst") {
            setAnalyst(event.payload);
          } else if (event.agent === "ux_planner") {
            setArchitect(event.payload);
          } else if (event.agent === "design_agent") {
            setTheme(event.payload);
          }
        } else if (event.type === "result") {
          appendActivity("Pipeline completed.");
          setTsx(event.tsx);
          setAnalyst(event.analyst);
          setArchitect(event.architect);
          setTheme(event.theme);
          setActiveAgent(null);
          setAttemptText(null);
        } else if (event.type === "generation_attempt") {
          setAttemptText(`Attempt ${event.attempt} of ${event.maxAttempts}`);
          appendActivity(`Generation attempt ${event.attempt} of ${event.maxAttempts}`);
        } else if (event.type === "generation_feedback") {
          setFeedback(event.message);
          appendActivity(`Feedback: ${event.message}`);
        } else if (event.type === "error") {
          appendActivity(`Error: ${event.message}`);
          throw new Error(event.message);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
      setActiveAgent(null);
    } finally {
      setLoading(false);
    }
  }, [appendActivity, prdText, tailwindTarget]);

  const copyTsx = useCallback(async () => {
    if (!tsx) return;
    await navigator.clipboard.writeText(tsx);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [tsx]);

  const exportStackBlitz = useCallback(async () => {
    if (!tsx) return;
    setError(null);
    setExportingStackBlitz(true);
    try {
      await openInStackBlitz(tsx, tailwindTarget);
    } catch (e) {
      setError(
        e instanceof Error
          ? `StackBlitz export failed: ${e.message}`
          : "StackBlitz export failed.",
      );
    } finally {
      setExportingStackBlitz(false);
    }
  }, [tsx, tailwindTarget]);

  const exportZip = useCallback(async () => {
    if (!tsx) return;
    setError(null);
    setExportingZip(true);
    try {
      await downloadViteProjectZip(tsx, tailwindTarget);
    } catch (e) {
      setError(
        e instanceof Error
          ? `ZIP export failed: ${e.message}`
          : "ZIP export failed.",
      );
    } finally {
      setExportingZip(false);
    }
  }, [tsx, tailwindTarget]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <section className="border-b border-gray-300 bg-white p-6 sm:p-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
            AI UI Component Generator
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Transform unstructured PRDs into structured UI with agent analysis, a
            component tree, theme styling, live preview, and production-oriented
            export (copy TSX, ZIP, or StackBlitz).
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 items-stretch border-b border-gray-300 lg:grid-cols-2 lg:min-h-[min(88vh,52rem)]">
        <section className="flex flex-col border-b border-gray-300 bg-gray-100 p-4 sm:p-6 lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="prd"
                className="text-sm font-medium text-gray-800"
              >
                Product requirements
              </label>
              <label className="cursor-pointer rounded-md border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:border-gray-400 hover:bg-gray-50">
                <input
                  type="file"
                  accept=".txt,text/plain"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                Upload .txt
              </label>
            </div>
            <textarea
              id="prd"
              value={prdText}
              onChange={(e) => setPrdText(e.target.value)}
              rows={12}
              placeholder="Paste your PRD here, or upload a .txt file…"
              className={`${inputBase} min-h-[min(40vh,18rem)] flex-1 resize-y font-mono text-sm leading-relaxed lg:min-h-[min(52vh,28rem)]`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <span>Tailwind target:</span>
                <select
                  value={tailwindTarget}
                  onChange={(e) =>
                    setTailwindTarget(e.target.value === "v3" ? "v3" : "v4")
                  }
                  className={`${inputBase} w-auto py-1.5`}
                >
                  <option value="v4">v4</option>
                  <option value="v3">v3</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => void generate()}
                disabled={loading || prdText.trim().length < 24}
                className={btnPrimary}
              >
                {loading ? "Running agents…" : "Generate UI"}
              </button>
              {activeAgent ? (
                <span className="text-sm text-gray-600">
                  Running:{" "}
                  <span className="font-medium text-gray-900">
                    {AGENT_LABEL[activeAgent]}
                  </span>
                </span>
              ) : null}
              {attemptText ? (
                <span className="text-sm text-gray-500">{attemptText}</span>
              ) : null}
            </div>
            {feedback ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {feedback}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {error}
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-white p-4 sm:p-6 lg:min-h-[min(88vh,52rem)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
              <p className="mt-1 text-sm text-gray-600">
                Live render (Tailwind CDN in iframe). Copy or export matches your
                Tailwind target.
              </p>
            </div>
            {tsx ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyTsx()}
                  className={btnNeutral}
                >
                  {copyDone ? "Copied TSX" : "Copy TSX"}
                </button>
                <button
                  type="button"
                  onClick={() => void exportZip()}
                  disabled={exportingZip}
                  className={btnGreen}
                >
                  {exportingZip ? "Preparing ZIP..." : "Download ZIP"}
                </button>
                <button
                  type="button"
                  onClick={() => void exportStackBlitz()}
                  disabled={exportingStackBlitz}
                  className={btnBlueSoft}
                >
                  {exportingStackBlitz
                    ? "Opening StackBlitz..."
                    : "Open in StackBlitz"}
                </button>
              </div>
            ) : null}
          </div>
          {tsx ? (
            <p className="mt-3 text-xs text-gray-500">
              ZIP is the same project as StackBlitz: unzip, run{" "}
              <code className="rounded bg-gray-200 px-1 py-0.5 text-gray-800">
                npm install
              </code>{" "}
              then{" "}
              <code className="rounded bg-gray-200 px-1 py-0.5 text-gray-800">
                npm run dev
              </code>
              .
            </p>
          ) : null}
          <div className="mt-4 flex min-h-[min(36vh,16rem)] flex-1 flex-col lg:min-h-0">
            {tsx ? (
              <ComponentPreview
                tsx={tsx}
                iframeHeightClass="h-[min(58vh,640px)]"
              />
            ) : loading ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <PreviewGenerating
                  agentLine={
                    activeAgent != null
                      ? `Running: ${AGENT_LABEL[activeAgent]}`
                      : "Starting pipeline…"
                  }
                  attemptText={attemptText}
                />
                {activityLog.length > 0 ? (
                  <div className="max-h-40 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Pipeline activity
                    </p>
                    <ul className="space-y-1 text-xs text-gray-700">
                      {activityLog.map((line, idx) => (
                        <li key={`${idx}-${line}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
                <p className="max-w-sm text-sm text-gray-600">
                  Your generated UI will appear here after you run{" "}
                  <span className="font-medium text-gray-800">Generate UI</span>
                  .
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {(analyst || architect || theme) && (
        <section className="max-h-[min(50vh,28rem)] overflow-y-auto border-b border-gray-300 p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Pipeline output
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Structured results from each agent (JSON).
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {analyst ? (
              <details
                open
                className="rounded-md border border-gray-300 bg-gray-50 p-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-gray-800">
                  PRD Analyst
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-white p-3 font-mono text-xs text-gray-800">
                  {JSON.stringify(analyst, null, 2)}
                </pre>
              </details>
            ) : null}
            {architect ? (
              <details
                open
                className="rounded-md border border-gray-300 bg-gray-50 p-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-gray-800">
                  UX Planner
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-white p-3 font-mono text-xs text-gray-800">
                  {JSON.stringify(architect, null, 2)}
                </pre>
              </details>
            ) : null}
            {theme ? (
              <details
                open
                className="rounded-md border border-gray-300 bg-gray-50 p-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-gray-800">
                  Design System Agent
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-white p-3 font-mono text-xs text-gray-800">
                  {JSON.stringify(theme, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        </section>
      )}

      {architect ? (
        <section className="border-b border-gray-300 p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Component tree
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {architect.layoutOverview}
          </p>
          <div className="mt-4">
            <ComponentTreeView architect={architect} />
          </div>
        </section>
      ) : null}

      {tsx ? (
        <section className="border-t border-gray-300 p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Generated code
          </h2>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-gray-300 bg-gray-50 p-4 font-mono text-xs text-gray-800">
            {tsx}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
