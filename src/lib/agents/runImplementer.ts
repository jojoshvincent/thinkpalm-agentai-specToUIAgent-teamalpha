import { getModel, getOpenAI } from "./openai";
import type { AnalystOutput, ArchitectOutput, ThemeOutput } from "./schemas";
import { extractTsx } from "./extractTsx";

const SYSTEM = `You are the Tailwind Implementer agent. You receive PRD context, analyst JSON, and architect component tree JSON.
Your job is to output ONE React component as TSX that renders a **single-page** UI matching the tree and requirements.

Rules:
- Use Tailwind CSS utility classes only (prefer Tailwind over inline styles).
- Use semantic HTML and basic accessibility (labels, button text, landmarks).
- The component must be exactly: \`export default function GeneratedPage() { return ( ... ); }\`
- **No import statements.** Use JSX with React in scope (the runtime will provide React).
- Do not use external libraries. React.useState / React.useReducer are allowed if the UI needs interaction.
- The root returned from GeneratedPage should be a single element with sensible min-height for a demo (e.g. min-h-screen or min-h-[560px]).
- Use realistic placeholder content where data is implied.
- Avoid plain left-aligned output. Build a polished composition with max-width container + centering + card/surface styling.
- Include meaningful color and hierarchy: at least one surface background, one accent color, varied text emphasis, and spacing rhythm.
- Ensure interactive controls include hover/focus-visible styles.
- Include a clearly styled hero/header area near the top with:
  - a prominent heading (h1 with strong typography like text-3xl+ / font-semibold+ / tracking-tight),
  - supporting subtitle/body text,
  - centered or intentionally composed alignment (not plain left-only flow).
- Ensure the main composition is visually centered using container rhythm (max-w-*, mx-auto, balanced vertical spacing).
- You will receive a theme object with class suggestions. Apply it consistently so output has strong contrast and visual identity.

Return TSX only (optionally wrapped in a \`\`\`tsx markdown fence).`;

export async function runImplementer(
  prdText: string,
  analyst: AnalystOutput,
  architect: ArchitectOutput,
  theme: ThemeOutput,
  options?: {
    tailwindTarget?: "v4" | "v3";
    revisionFeedback?: string;
  },
): Promise<string> {
  const openai = getOpenAI();
  const model = getModel();

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.35,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify(
          {
            tailwindTarget: options?.tailwindTarget ?? "v4",
            originalPrd: prdText.slice(0, 24_000),
            analyst,
            architect,
            theme,
            revisionFeedback:
              options?.revisionFeedback ??
              "First pass: produce your best polished output.",
          },
          null,
          2,
        ),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Tailwind Implementer returned empty content.");
  }
  return extractTsx(text).trim();
}
