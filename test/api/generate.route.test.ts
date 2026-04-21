import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agents/pipeline", () => ({
  runPipeline: vi.fn(),
}));

import { runPipeline } from "@/lib/agents/pipeline";
import { POST } from "@/app/api/generate/route";

describe("POST /api/generate", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.clearAllMocks();
  });

  it("returns 400 for short PRD", async () => {
    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ prdText: "too short" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("streams ndjson events", async () => {
    vi.mocked(runPipeline).mockImplementation(async function* () {
      yield { type: "agent_start", agent: "prd_analyst" } as const;
      yield {
        type: "result",
        tsx: "export default function GeneratedPage(){return <div />;}",
        analyst: {
          productSummary: "s",
          userGoals: [],
          keyFeatures: [],
          uiSurfaceDescription: "u",
          constraints: [],
          accessibilityNotes: [],
          screens: [],
          userFlows: [],
          confidence: 0.8,
        },
        architect: {
          pageTitle: "p",
          layoutOverview: "l",
          uiPatterns: [],
          responsivenessPlan: [],
          nodes: [],
          confidence: 0.8,
        },
        theme: {
          themeName: "t",
          mood: "m",
          backgroundClass: "bg-white",
          surfaceClass: "bg-white",
          headingClass: "text-black",
          bodyTextClass: "text-black",
          accentClass: "text-blue-500",
          borderClass: "border-gray-200",
          contrastNotes: [],
          spacingScale: [],
          typographyScale: [],
          colorRoles: [],
          confidence: 0.8,
        },
      } as const;
    });

    const req = new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({
        prdText: "This PRD is definitely long enough for validation checks.",
        tailwindTarget: "v4",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");

    const text = await res.text();
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).type).toBe("agent_start");
    expect(JSON.parse(lines[1]).type).toBe("result");
  });
});
