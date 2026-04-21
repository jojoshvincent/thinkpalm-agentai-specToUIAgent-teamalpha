"use client";

import { useCallback, useState } from "react";
import { ComponentPreview } from "./ComponentPreview";
import { openInStackBlitz } from "@/lib/export/stackblitz";
import type {
  AnalystOutput,
  ArchitectOutput,
  ThemeOutput,
} from "@/lib/agents/schemas";
import type { AgentId, PipelineEvent } from "@/lib/agents/pipeline";

const AGENT_LABEL: Record<AgentId, string> = {
  requirements_analyst: "Requirements Analyst",
  ui_architect: "UI Architect",
  theme_stylist: "Theme Stylist",
  tailwind_implementer: "Tailwind Implementer",
  runtime_validator: "Runtime Validator",
  ui_critic: "UI Critic",
};

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
  const [exporting, setExporting] = useState(false);

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
        } else if (event.type === "agent_complete") {
          if (event.agent === "requirements_analyst") {
            setAnalyst(event.payload);
          } else if (event.agent === "ui_architect") {
            setArchitect(event.payload);
          } else if (event.agent === "theme_stylist") {
            setTheme(event.payload);
          }
        } else if (event.type === "result") {
          setTsx(event.tsx);
          setAnalyst(event.analyst);
          setArchitect(event.architect);
          setTheme(event.theme);
          setActiveAgent(null);
          setAttemptText(null);
        } else if (event.type === "generation_attempt") {
          setAttemptText(`Attempt ${event.attempt} of ${event.maxAttempts}`);
        } else if (event.type === "generation_feedback") {
          setFeedback(event.message);
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
      setActiveAgent(null);
    } finally {
      setLoading(false);
    }
  }, [prdText, tailwindTarget]);

  const copyTsx = useCallback(async () => {
    if (!tsx) return;
    await navigator.clipboard.writeText(tsx);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [tsx]);

  const exportStackBlitz = useCallback(async () => {
    if (!tsx) return;
    setError(null);
    setExporting(true);
    try {
      await openInStackBlitz(tsx, tailwindTarget);
    } catch (e) {
      setError(
        e instanceof Error
          ? `StackBlitz export failed: ${e.message}`
          : "StackBlitz export failed.",
      );
    } finally {
      setExporting(false);
    }
  }, [tsx, tailwindTarget]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Agentic UI generator
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          PRD → multi-agent pipeline → Tailwind UI
        </h1>
        <p className="max-w-2xl text-pretty text-zinc-600 dark:text-zinc-400">
          Multi-agent pipeline runs on the server: requirements analysis,
          component tree, contrast theme styling, Tailwind TSX generation, and
          quality critique. Paste a PRD or upload a{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm dark:bg-zinc-800">
            .txt
          </code>{" "}
          file, generate, preview live, copy TSX, or export to StackBlitz.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            htmlFor="prd"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Product requirements
          </label>
          <label className="cursor-pointer rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/60">
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
          className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm leading-relaxed text-zinc-900 shadow-sm outline-none ring-zinc-400/30 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span>Tailwind target:</span>
            <select
              value={tailwindTarget}
              onChange={(e) =>
                setTailwindTarget(e.target.value === "v3" ? "v3" : "v4")
              }
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="v4">v4</option>
              <option value="v3">v3</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading || prdText.trim().length < 24}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {loading ? "Running agents…" : "Generate UI"}
          </button>
          {activeAgent ? (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Running:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {AGENT_LABEL[activeAgent]}
              </span>
            </span>
          ) : null}
          {attemptText ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {attemptText}
            </span>
          ) : null}
        </div>
        {feedback ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            {feedback}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
            {error}
          </p>
        ) : null}
      </section>

      {(analyst || architect || theme) && (
        <section className="grid gap-4 lg:grid-cols-3">
          {analyst ? (
            <details
              open
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
            >
              <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Agent 1 — Requirements Analyst (JSON)
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {JSON.stringify(analyst, null, 2)}
              </pre>
            </details>
          ) : null}
          {architect ? (
            <details
              open
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
            >
              <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Agent 2 — UI Architect (component tree)
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {JSON.stringify(architect, null, 2)}
              </pre>
            </details>
          ) : null}
          {theme ? (
            <details
              open
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
            >
              <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Agent 3 — Theme Stylist (contrast plan)
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {JSON.stringify(theme, null, 2)}
              </pre>
            </details>
          ) : null}
        </section>
      )}

      {tsx ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Preview (Agent 3 output)
            </h2>
            <button
              type="button"
              onClick={() => void copyTsx()}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {copyDone ? "Copied TSX" : "Copy TSX"}
            </button>
            <button
              type="button"
              onClick={() => void exportStackBlitz()}
              disabled={exporting}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:bg-blue-900/50"
            >
              {exporting ? "Opening StackBlitz..." : "Open in StackBlitz"}
            </button>
          </div>
          <ComponentPreview tsx={tsx} />
          <details className="rounded-xl border border-zinc-200 dark:border-zinc-700">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              View generated code
            </summary>
            <pre className="max-h-96 overflow-auto border-t border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
              {tsx}
            </pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}
