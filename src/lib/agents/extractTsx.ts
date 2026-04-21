/**
 * Pull TSX/JSX out of a fenced markdown block if the model added one.
 */
export function extractTsx(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(
    /^```(?:tsx|jsx|javascript|js)?\s*\n([\s\S]*?)\n```$/m,
  );
  if (fence) {
    return fence[1].trim();
  }
  const inner = trimmed.match(/```(?:tsx|jsx)?\n([\s\S]*?)```/);
  if (inner) {
    return inner[1].trim();
  }
  return trimmed;
}
