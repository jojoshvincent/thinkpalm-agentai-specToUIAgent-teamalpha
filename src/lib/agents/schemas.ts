import { z } from "zod";

const confidenceSchema = z.number().min(0).max(1);

/** Agent 1 — PRD analyst (structured spec) */
export const analystOutputSchema = z.object({
  productSummary: z.string(),
  userGoals: z.array(z.string()),
  keyFeatures: z.array(z.string()),
  uiSurfaceDescription: z.string(),
  constraints: z.array(z.string()),
  accessibilityNotes: z.array(z.string()),
  screens: z.array(z.string()),
  userFlows: z.array(z.string()),
  confidence: confidenceSchema,
});

export type AnalystOutput = z.infer<typeof analystOutputSchema>;

/** Agent 2 — UX planner (component hierarchy) */
export const architectOutputSchema = z.object({
  pageTitle: z.string(),
  layoutOverview: z.string(),
  uiPatterns: z.array(z.string()),
  responsivenessPlan: z.array(z.string()),
  nodes: z.array(
    z.object({
      id: z.string(),
      parentId: z.string().nullable(),
      name: z.string(),
      role: z.enum([
        "container",
        "section",
        "header",
        "nav",
        "main",
        "footer",
        "form",
        "list",
        "card",
        "toolbar",
        "content",
        "input",
        "feedback",
        "misc",
      ]),
      purpose: z.string(),
      tailwindIntent: z.string(),
      htmlElement: z.string(),
    }),
  ),
  confidence: confidenceSchema,
});

export type ArchitectOutput = z.infer<typeof architectOutputSchema>;

/** Agent 3 — design system planner (tokenized direction) */
export const themeOutputSchema = z.object({
  themeName: z.string(),
  mood: z.string(),
  backgroundClass: z.string(),
  surfaceClass: z.string(),
  headingClass: z.string(),
  bodyTextClass: z.string(),
  accentClass: z.string(),
  borderClass: z.string(),
  contrastNotes: z.array(z.string()),
  spacingScale: z.array(z.string()),
  typographyScale: z.array(z.string()),
  colorRoles: z.array(z.string()),
  confidence: confidenceSchema,
});

export type ThemeOutput = z.infer<typeof themeOutputSchema>;

/** Agent 5 — QA / critic decision */
export const qaDecisionSchema = z.enum(["approve", "refine", "reject"]);

export const qaOutputSchema = z.object({
  decision: qaDecisionSchema,
  severity: z.enum(["blocker", "warning", "nit"]),
  routeTo: z.enum(["ui_generator", "ux_planner"]).default("ui_generator"),
  issues: z.array(z.string()),
  fixes: z.array(z.string()),
  summary: z.string(),
  confidence: confidenceSchema,
});

export type QaOutput = z.infer<typeof qaOutputSchema>;

export const pipelineStateSchema = z.object({
  jobId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  currentAgent: z
    .enum([
      "prd_analyst",
      "ux_planner",
      "design_agent",
      "ui_generator",
      "qa_agent",
    ])
    .nullable(),
  prdText: z.string(),
  tailwindTarget: z.enum(["v4", "v3"]),
  attempt: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  revisionFeedback: z.string(),
  lastIssues: z.array(z.string()),
  lastTsx: z.string().default(""),
  analyst: analystOutputSchema.nullable(),
  architect: architectOutputSchema.nullable(),
  theme: themeOutputSchema.nullable(),
  qa: qaOutputSchema.nullable(),
});

export type PipelineState = z.infer<typeof pipelineStateSchema>;
