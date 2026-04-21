import { toLivePreviewCode } from "@/lib/agents/toLivePreviewCode";

/**
 * Escape sequences that would break an inline </script> block in HTML.
 */
function escapeForInlineScript(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

const PREVIEW_BOOTSTRAP = `
const { useState, useEffect, useReducer, useMemo, useCallback, useRef } = React;
const root = ReactDOM.createRoot(document.getElementById("root"));
function render(element) {
  root.render(element);
}
`.trim();

/**
 * Full HTML document for an iframe: Tailwind CDN (JIT at runtime) + React 18 + Babel,
 * so AI-generated class names work without being present at Next.js build time.
 */
export function buildPreviewSrcDoc(tsx: string): string {
  const userCode = toLivePreviewCode(tsx);
  const body = `${PREVIEW_BOOTSTRAP}\n\n${userCode}`;
  const escaped = escapeForInlineScript(body);

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<script src="https://cdn.tailwindcss.com"></script>',
    "<script>",
    "tailwind.config = { darkMode: 'class' };",
    "</script>",
    '<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>',
    '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>',
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>',
    "<style>",
    "html, body, #root { min-height: 100%; margin: 0; }",
    "body { -webkit-font-smoothing: antialiased; }",
    "body { background: linear-gradient(160deg, #f8fafc 0%, #e2e8f0 45%, #dbeafe 100%); }",
    "</style>",
    "</head>",
    '<body class="min-h-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">',
    '<div id="root"></div>',
    '<script type="text/babel" data-presets="react,typescript">',
    escaped,
    "</script>",
    "</body>",
    "</html>",
  ].join("");
}
