import { zodResponseFormat } from "openai/helpers/zod";
import { getModel, getOpenAI } from "./openai";
import { architectOutputSchema, type AnalystOutput, type ArchitectOutput } from "./schemas";

const SYSTEM = `You are the UX Planner agent. You receive structured analysis of a PRD.
Design a single-page component tree for one primary screen only (not a full app or routing).
Use a flat list of nodes with unique string ids (e.g. "n1", "n2"). Exactly one node must have parentId null (the root).
Children reference parents via parentId. Keep the tree reasonably small (typically 8–24 nodes) but complete enough to implement the UI.
Include a short list of UI patterns and a responsiveness plan.
Each node describes purpose and Tailwind intent (spacing, layout, emphasis) not final class strings.
The htmlElement should be a semantic HTML tag name (div, main, section, header, nav, form, button, etc.).`;

export async function runArchitect(
  prdText: string,
  analyst: AnalystOutput,
): Promise<ArchitectOutput> {
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
            originalPrd: prdText.slice(0, 24_000),
            analyst,
          },
          null,
          2,
        ),
      },
    ],
    response_format: zodResponseFormat(architectOutputSchema, "architect_output"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(
      completion.choices[0]?.message?.refusal ??
        "UX Planner produced no structured output.",
    );
  }
  return parsed;
}
