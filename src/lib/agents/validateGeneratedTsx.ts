const LAYOUT_HINTS = [
  "mx-auto",
  "max-w-",
  "min-h-screen",
  "justify-center",
  "items-center",
  "grid",
  "flex",
];

const COLOR_HINTS = [
  "bg-",
  "text-",
  "border-",
  "from-",
  "to-",
  "ring-",
];

const HEADING_STYLE_HINTS = [
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "font-semibold",
  "font-bold",
  "tracking-tight",
];

export type TsxValidationResult = {
  pass: boolean;
  issues: string[];
};

export function validateGeneratedTsx(tsx: string): TsxValidationResult {
  const issues: string[] = [];
  const classNameMatches = tsx.match(/className\s*=\s*"([^"]+)"/g) ?? [];
  const utilityTokenMatches = tsx.match(/[a-z-]+(?:\[[^\]]+\])?(?:\/\d+)?/g) ?? [];

  if (!/export\s+default\s+function\s+GeneratedPage/.test(tsx)) {
    issues.push("Missing required `export default function GeneratedPage`.");
  }

  if (classNameMatches.length < 8) {
    issues.push("Too few styled elements; expected richer Tailwind coverage.");
  }

  if (utilityTokenMatches.length < 60) {
    issues.push("Tailwind utility density is too low for a polished UI.");
  }

  if (!LAYOUT_HINTS.some((token) => tsx.includes(token))) {
    issues.push("No strong layout primitives found (max-width/centering/grid/flex).");
  }

  if (!tsx.includes("text-center")) {
    issues.push("Missing centered composition cue (`text-center`) for hero/header polish.");
  }

  const colorCount = COLOR_HINTS.reduce(
    (acc, token) => acc + (tsx.match(new RegExp(token.replace("-", "\\-"), "g"))?.length ?? 0),
    0,
  );
  if (colorCount < 8) {
    issues.push("Not enough visual styling tokens (color/background/border/ring).");
  }

  if (!tsx.includes("rounded-")) {
    issues.push("No shape styling found (missing rounded-* classes).");
  }

  if (!/hover:|focus:/.test(tsx)) {
    issues.push("Interactive state styles are missing (hover/focus).");
  }

  if (!/<h1[\s>]/.test(tsx)) {
    issues.push("Missing a prominent page heading (`<h1>`).");
  }

  if (!HEADING_STYLE_HINTS.some((token) => tsx.includes(token))) {
    issues.push("Heading typography is too plain; expected strong title styles.");
  }

  return {
    pass: issues.length === 0,
    issues,
  };
}
