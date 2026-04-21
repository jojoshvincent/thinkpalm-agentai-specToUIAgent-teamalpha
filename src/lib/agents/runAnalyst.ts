import { zodResponseFormat } from "openai/helpers/zod";
import { getModel, getOpenAI } from "./openai";
import { analystOutputSchema, type AnalystOutput } from "./schemas";

const SYSTEM = `You are the Requirements Analyst agent in a multi-agent UI pipeline.
Read the product requirements document (PRD) and extract structured facts only.
Do not invent features not implied by the text; if something is unclear, state it in constraints or accessibilityNotes.
Output must match the JSON schema exactly (via structured output).`;

export async function runAnalyst(prdText: string): Promise<AnalystOutput> {
  const openai = getOpenAI();
  const model = getModel();

  const completion = await openai.chat.completions.parse({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `PRD:\n\n${prdText}`,
      },
    ],
    response_format: zodResponseFormat(analystOutputSchema, "analyst_output"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(
      completion.choices[0]?.message?.refusal ??
        "Requirements Analyst produced no structured output.",
    );
  }
  return parsed;
}
