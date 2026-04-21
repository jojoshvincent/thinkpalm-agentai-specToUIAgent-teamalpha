import { extractTsx } from "./extractTsx";

/**
 * Iframe preview (Babel + React UMD) expects a `render(...)` call. We adapt
 * copy-pastable TSX that uses `export default function GeneratedPage` into that shape.
 */
export function toLivePreviewCode(tsx: string): string {
  let c = extractTsx(tsx).trim();
  if (/render\s*\(/.test(c)) {
    return c;
  }

  c = c.replace(
    /export\s+default\s+function\s+GeneratedPage\b/,
    "function GeneratedPage",
  );

  if (!/function\s+GeneratedPage\s*\(/.test(c)) {
    if (c.startsWith("<")) {
      return `function GeneratedPage() {\n  return (\n${c}\n  );\n}\nrender(<GeneratedPage />);`;
    }
    throw new Error(
      "Expected export default function GeneratedPage or a JSX root for preview.",
    );
  }

  return `${c}\nrender(<GeneratedPage />);`;
}
