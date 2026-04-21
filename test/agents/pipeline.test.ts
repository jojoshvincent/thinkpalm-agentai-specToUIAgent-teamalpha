import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agents/runAnalyst", () => ({ runAnalyst: vi.fn() }));
vi.mock("@/lib/agents/runArchitect", () => ({ runArchitect: vi.fn() }));
vi.mock("@/lib/agents/runThemeStylist", () => ({ runThemeStylist: vi.fn() }));
vi.mock("@/lib/agents/runImplementer", () => ({ runImplementer: vi.fn() }));
vi.mock("@/lib/agents/runCritic", () => ({ runCritic: vi.fn() }));
vi.mock("@/lib/agents/validateGeneratedTsx", () => ({
  validateGeneratedTsx: vi.fn(),
}));
vi.mock("@/lib/agents/stateStore", () => ({
  writePipelineState: vi.fn().mockResolvedValue(undefined),
}));

import { runAnalyst } from "@/lib/agents/runAnalyst";
import { runArchitect } from "@/lib/agents/runArchitect";
import { runThemeStylist } from "@/lib/agents/runThemeStylist";
import { runImplementer } from "@/lib/agents/runImplementer";
import { runCritic } from "@/lib/agents/runCritic";
import { validateGeneratedTsx } from "@/lib/agents/validateGeneratedTsx";
import { runPipeline } from "@/lib/agents/pipeline";

const analyst = {
  productSummary: "summary",
  userGoals: ["goal"],
  keyFeatures: ["feature"],
  uiSurfaceDescription: "surface",
  constraints: [],
  accessibilityNotes: [],
  screens: ["home"],
  userFlows: ["enter -> use"],
  confidence: 0.9,
};

const architect = {
  pageTitle: "Dashboard",
  layoutOverview: "Centered dashboard layout",
  uiPatterns: ["dashboard", "card"],
  responsivenessPlan: ["Stack cards on mobile"],
  nodes: [
    {
      id: "n1",
      parentId: null,
      name: "Root",
      role: "main",
      purpose: "Root layout",
      tailwindIntent: "centered container",
      htmlElement: "main",
    },
  ],
  confidence: 0.88,
};

const theme = {
  themeName: "Clean Blue",
  mood: "Professional",
  backgroundClass: "bg-gray-50",
  surfaceClass: "bg-white",
  headingClass: "text-gray-900",
  bodyTextClass: "text-gray-700",
  accentClass: "text-blue-600",
  borderClass: "border-gray-200",
  contrastNotes: ["Passes normal contrast"],
  spacingScale: ["space-y-4"],
  typographyScale: ["text-sm", "text-2xl"],
  colorRoles: ["primary", "surface", "muted"],
  confidence: 0.86,
};

const generatedTsx = `
export default function GeneratedPage() {
  return <main className="min-h-screen text-center" />;
}
`;

describe("runPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runAnalyst).mockResolvedValue(analyst);
    vi.mocked(runArchitect).mockResolvedValue(architect);
    vi.mocked(runThemeStylist).mockResolvedValue(theme);
    vi.mocked(runImplementer).mockResolvedValue(generatedTsx);
    vi.mocked(validateGeneratedTsx).mockReturnValue({ pass: true, issues: [] });
  });

  it("completes when qa approves", async () => {
    vi.mocked(runCritic).mockResolvedValue({
      decision: "approve",
      severity: "warning",
      routeTo: "ui_generator",
      issues: [],
      fixes: [],
      summary: "Looks good",
      confidence: 0.9,
    });

    const events = [];
    for await (const e of runPipeline("A detailed PRD text for testing.", {})) {
      events.push(e);
    }

    expect(events.some((e) => e.type === "agent_start" && e.agent === "prd_analyst")).toBe(true);
    expect(events.some((e) => e.type === "agent_start" && e.agent === "qa_agent")).toBe(true);
    expect(events.at(-1)?.type).toBe("result");
  });

  it("retries generation when qa asks for refinement", async () => {
    vi.mocked(runCritic)
      .mockResolvedValueOnce({
        decision: "refine",
        severity: "blocker",
        routeTo: "ui_generator",
        issues: ["Missing error state"],
        fixes: ["Add inline error alert style"],
        summary: "Needs a state treatment",
        confidence: 0.7,
      })
      .mockResolvedValueOnce({
        decision: "approve",
        severity: "warning",
        routeTo: "ui_generator",
        issues: [],
        fixes: [],
        summary: "Improved",
        confidence: 0.91,
      });

    const events = [];
    for await (const e of runPipeline("A detailed PRD text for testing.", {})) {
      events.push(e);
    }

    const attempts = events.filter((e) => e.type === "generation_attempt");
    expect(attempts).toHaveLength(2);
    expect(vi.mocked(runImplementer)).toHaveBeenCalledTimes(2);
    expect(events.some((e) => e.type === "generation_feedback")).toBe(true);
  });
});
