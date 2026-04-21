import { zodResponseFormat } from "openai/helpers/zod";
import { getModel, getOpenAI } from "./openai";
import {
  themeOutputSchema,
  type AnalystOutput,
  type ArchitectOutput,
  type ThemeOutput,
} from "./schemas";

const SYSTEM = `You are the Theme Stylist agent.
Pick a visually pleasing high-contrast Tailwind theme for a single-page UI when PRD does not define one.

Rules:
- Favor contrast and readability over novelty.
- Produce classes compatible with the requested Tailwind target.
- Output should define an app-level visual direction (background, surface, heading, body text, accent, border).
- Avoid overly dark-on-dark or light-on-light pairings.
- Prefer a coherent palette family, not random colors.

Return strict JSON matching the provided schema only.`;

export async function runThemeStylist(input: {
  prdText: string;
  analyst: AnalystOutput;
  architect: ArchitectOutput;
  tailwindTarget: "v4" | "v3";
}): Promise<ThemeOutput> {
  const openai = getOpenAI();
  const model = getModel();

  const completion = await openai.chat.completions.parse({
    model,
    temperature: 0.25,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify(
          {
            tailwindTarget: input.tailwindTarget,
            prdText: input.prdText.slice(0, 24000),
            analyst: input.analyst,
            architect: input.architect,
          },
          null,
          2,
        ),
      },
    ],
    response_format: zodResponseFormat(themeOutputSchema, "theme_output"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(
      completion.choices[0]?.message?.refusal ??
        "Theme Stylist produced no structured output.",
    );
  }
  return parsed;
}
