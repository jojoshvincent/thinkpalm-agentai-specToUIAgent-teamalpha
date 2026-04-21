import { describe, expect, it } from "vitest";
import {
  analystOutputSchema,
  pipelineStateSchema,
  qaOutputSchema,
} from "@/lib/agents/schemas";

describe("agent schemas", () => {
  it("accepts valid analyst output", () => {
    const parsed = analystOutputSchema.parse({
      productSummary: "A dashboard app for team reporting",
      userGoals: ["Understand KPIs quickly"],
      keyFeatures: ["KPI cards", "Recent activity"],
      uiSurfaceDescription: "Single-page dashboard with summary and table",
      constraints: ["No auth required"],
      accessibilityNotes: ["Use semantic headings"],
      screens: ["Dashboard"],
      userFlows: ["Open dashboard -> review metrics"],
      confidence: 0.83,
    });

    expect(parsed.confidence).toBeGreaterThan(0.8);
  });

  it("rejects invalid qa decision payload", () => {
    expect(() =>
      qaOutputSchema.parse({
        decision: "unknown",
        severity: "warning",
        routeTo: "ui_generator",
        issues: [],
        fixes: [],
        summary: "Bad output",
        confidence: 0.7,
      }),
    ).toThrow();
  });

  it("enforces confidence range on pipeline state", () => {
    expect(() =>
      pipelineStateSchema.parse({
        jobId: "job-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "running",
        currentAgent: "qa_agent",
        prdText: "x".repeat(40),
        tailwindTarget: "v4",
        attempt: 1,
        maxAttempts: 3,
        revisionFeedback: "",
        lastIssues: [],
        lastTsx: "",
        analyst: {
          productSummary: "x",
          userGoals: [],
          keyFeatures: [],
          uiSurfaceDescription: "x",
          constraints: [],
          accessibilityNotes: [],
          screens: [],
          userFlows: [],
          confidence: 1.4,
        },
        architect: null,
        theme: null,
        qa: null,
      }),
    ).toThrow();
  });
});
