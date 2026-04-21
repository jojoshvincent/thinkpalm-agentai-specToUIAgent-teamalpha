import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getModel, getOpenAI } from "./openai";
import type { AnalystOutput, ArchitectOutput, ThemeOutput } from "./schemas";

const criticOutputSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  revisionPrompt: z.string(),
});

export type CriticOutput = z.infer<typeof criticOutputSchema>;

const SYSTEM = `You are the UI Quality Critic agent.
Review generated TSX for visual quality and Tailwind usage quality.
Your goal is to avoid plain left-aligned HTML-like output.

Criteria:
- Visual richness: meaningful color, spacing, typography hierarchy, card/surface styling.
- Layout quality: centered/max-width composition, responsive structure, good whitespace rhythm.
- Heading quality: top heading should feel designed (size/weight/spacing/tone), not plain body-like text.
- Interaction polish: hover/focus states on interactive controls where relevant.
- Accessibility: semantic landmarks/labels and readable contrast.
- Tailwind target compatibility: classes should align with the requested Tailwind target.
- Theme usage: generated output should visibly apply the provided theme direction, not ignore it.

Return strict JSON matching schema.
Set pass=true only if score >= 75 and there are no severe issues.
revisionPrompt should be concise, actionable instructions for a rewrite pass.`;

export async function runCritic(input: {
  prdText: string;
  analyst: AnalystOutput;
  architect: ArchitectOutput;
  theme: ThemeOutput;
  tsx: string;
  tailwindTarget: "v4" | "v3";
}): Promise<CriticOutput> {
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
    response_format: zodResponseFormat(criticOutputSchema, "critic_output"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(
      completion.choices[0]?.message?.refusal ??
        "UI Critic produced no structured output.",
    );
  }
  return parsed;
}
