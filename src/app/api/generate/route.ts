import { runPipeline } from "@/lib/agents/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { prdText?: unknown; tailwindTarget?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prdText =
    typeof body.prdText === "string" ? body.prdText.trim() : "";
  const tailwindTarget: "v4" | "v3" =
    body.tailwindTarget === "v3" ? "v3" : "v4";

  if (prdText.length < 24) {
    return Response.json(
      {
        error:
          "PRD text is too short. Paste or upload a bit more detail (at least a few sentences).",
      },
      { status: 400 },
    );
  }

  if (prdText.length > 48_000) {
    return Response.json(
      { error: "PRD text is too long (max ~48k characters)." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runPipeline(prdText, { tailwindTarget })) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
