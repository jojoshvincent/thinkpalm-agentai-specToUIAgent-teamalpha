import { zodResponseFormat } from "openai/helpers/zod";
import { getModel, getOpenAI } from "./openai";
import type { AnalystOutput, ArchitectOutput, ThemeOutput } from "./schemas";
import { qaOutputSchema, type QaOutput } from "./schemas";

const SYSTEM = `You are the QA Agent for a UI generation pipeline.
Review generated TSX for visual quality and Tailwind usage quality.
Your output is a strict decision: approve, refine, or reject.

Criteria:
- Visual richness: meaningful color, spacing, typography hierarchy, card/surface styling.
- Layout quality: centered/max-width composition, responsive structure, good whitespace rhythm.
- Heading quality: top heading should feel designed (size/weight/spacing/tone), not plain body-like text.
- Interaction polish: hover/focus states on interactive controls where relevant.
- Accessibility: semantic landmarks/labels and readable contrast.
- Tailwind target compatibility: classes should align with the requested Tailwind target.
- Theme usage: generated output should visibly apply the provided theme direction, not ignore it.
- Detect missing states (empty, loading, and error affordances where relevant).

Return strict JSON matching schema.
Set:
- decision=approve only if there are no blocker issues and quality is acceptable.
- decision=refine when issues are fixable in another generation pass.
- decision=reject only for severe or repeated fundamental failures.
- routeTo=ux_planner when structure/hierarchy is the main problem; otherwise ui_generator.
- confidence between 0 and 1.
- fixes must be concrete, short, and actionable.`;

export async function runCritic(input: {
  prdText: string;
  analyst: AnalystOutput;
  architect: ArchitectOutput;
  theme: ThemeOutput;
  tsx: string;
  tailwindTarget: "v4" | "v3";
}): Promise<QaOutput> {
  const openai = getOpenAI();
  const model = getModel();

  const completion = await openai.chat.completions.parse({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify(
          {
            tailwindTarget: input.tailwindTarget,
            originalPrd: input.prdText.slice(0, 24000),
            analyst: input.analyst,
            architect: input.architect,
            theme: input.theme,
            generatedTsx: input.tsx,
          },
          null,
          2,
        ),
      },
    ],
    response_format: zodResponseFormat(qaOutputSchema, "qa_output"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(
      completion.choices[0]?.message?.refusal ??
        "QA agent produced no structured output.",
    );
  }
  return parsed;
}
