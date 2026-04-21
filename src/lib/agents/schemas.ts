import { z } from "zod";

/** Agent 1 — structured understanding of the PRD */
export const analystOutputSchema = z.object({
  productSummary: z.string(),
  userGoals: z.array(z.string()),
  keyFeatures: z.array(z.string()),
  uiSurfaceDescription: z.string(),
  constraints: z.array(z.string()),
  accessibilityNotes: z.array(z.string()),
});

export type AnalystOutput = z.infer<typeof analystOutputSchema>;

/** Agent 2 — component tree (flat list with parent links) */
export const architectOutputSchema = z.object({
  pageTitle: z.string(),
  layoutOverview: z.string(),
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
});

export type ArchitectOutput = z.infer<typeof architectOutputSchema>;

/** Agent 3 — contrast-aware visual theme plan */
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
});

export type ThemeOutput = z.infer<typeof themeOutputSchema>;
