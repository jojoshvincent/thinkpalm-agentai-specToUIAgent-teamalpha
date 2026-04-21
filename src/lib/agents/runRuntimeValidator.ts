import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getModel, getOpenAI } from "./openai";

const runtimeValidationSchema = z.object({
  pass: z.boolean(),
  likelyRuntimeErrors: z.array(z.string()),
  repairPrompt: z.string(),
});

export type RuntimeValidationOutput = z.infer<typeof runtimeValidationSchema>;

const SYSTEM = `You are the Runtime Validator agent for generated React TSX.
Detect likely runtime or compile-time issues before export.

Focus on:
- Invalid JSX / malformed tags.
- Missing component default export shape.
- Disallowed imports or external library references.
- Hook misuse patterns (non-component scope or obvious mistakes).
- Browser/runtime mismatches for Vite React.

Return strict JSON.
Set pass=true only if code appears likely to run in a basic Vite React TypeScript project.`;

export async function runRuntimeValidator(input: {
  tsx: string;
  tailwindTarget: "v4" | "v3";
}): Promise<RuntimeValidationOutput> {
  const openai = getOpenAI();
  const model = getModel();

  const completion = await openai.chat.completions.parse({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify(
          {
            tailwindTarget: input.tailwindTarget,
            generatedTsx: input.tsx,
          },
          null,
          2,
        ),
      },
    ],
    response_format: zodResponseFormat(
      runtimeValidationSchema,
      "runtime_validation_output",
    ),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(
      completion.choices[0]?.message?.refusal ??
        "Runtime Validator produced no structured output.",
    );
  }
  return parsed;
}
