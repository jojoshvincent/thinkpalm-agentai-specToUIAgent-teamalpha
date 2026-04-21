import { extractTsx } from "@/lib/agents/extractTsx";

export type TailwindExportTarget = "v4" | "v3";

function assertExportableTsx(tsx: string): void {
  if (tsx.length > 80_000) {
    throw new Error("Generated TSX is too large to export safely.");
  }
  if (/from\s+["'](next|next\/|@\/)/.test(tsx)) {
    throw new Error(
      "Generated code references framework-specific imports not supported in Vite export.",
    );
  }
  if (/import\s+/.test(tsx)) {
    throw new Error(
      "Generated code includes imports; export expects a self-contained component.",
    );
  }
  if (!/export\s+default\s+function\s+GeneratedPage/.test(tsx) && !tsx.trim().startsWith("<")) {
    throw new Error(
      "Generated code is not in expected component format for export.",
    );
  }
}

function toAppTsx(tsx: string): string {
  let code = extractTsx(tsx).trim();

  if (!code) {
    throw new Error("Cannot export empty TSX.");
  }

  code = code.replace(
    /export\s+default\s+function\s+GeneratedPage\b/,
    "function GeneratedPage",
  );

  if (!/function\s+GeneratedPage\s*\(/.test(code)) {
    if (code.startsWith("<")) {
      code = `function GeneratedPage() {\n  return (\n${code}\n  );\n}\n`;
    } else {
      throw new Error(
        "Generated code must include `export default function GeneratedPage` or JSX root.",
      );
    }
  }

  return `import React from "react";

${code}

export default function App() {
  return <GeneratedPage />;
}
`;
}

function viteFilesForV4(appTsx: string): Record<string, string> {
  return {
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI UI Export</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
    "src/App.tsx": appTsx,
    "src/index.css": `@import "tailwindcss";`,
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
    "postcss.config.cjs": `module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`,
    "package.json": `{
  "name": "ai-ui-export-v4",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
`,
    "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
  };
}

function viteFilesForV3(appTsx: string): Record<string, string> {
  return {
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI UI Export</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
    "src/App.tsx": appTsx,
    "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
    "tailwind.config.cjs": `module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
    "postcss.config.cjs": `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
    "package.json": `{
  "name": "ai-ui-export-v3",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
`,
    "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
  };
}

/**
 * Same Vite + React + Tailwind file tree used for StackBlitz and ZIP download.
 */
export function buildViteExportFiles(
  tsx: string,
  tailwindTarget: TailwindExportTarget,
): Record<string, string> {
  assertExportableTsx(tsx);
  const appTsx = toAppTsx(tsx);
  const files =
    tailwindTarget === "v3" ? viteFilesForV3(appTsx) : viteFilesForV4(appTsx);

  const required = ["package.json", "index.html", "src/main.tsx", "src/App.tsx"];
  for (const file of required) {
    if (!files[file]) {
      throw new Error(`Export template missing required file: ${file}`);
    }
  }
  return files;
}

/**
 * Download the same project as a ZIP (run locally with `npm install` then `npm run dev`).
 */
export async function downloadViteProjectZip(
  tsx: string,
  tailwindTarget: TailwindExportTarget,
): Promise<void> {
  const files = buildViteExportFiles(tsx, tailwindTarget);
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-ui-export-${tailwindTarget}.zip`;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

export async function openInStackBlitz(
  tsx: string,
  tailwindTarget: TailwindExportTarget,
): Promise<void> {
  const files = buildViteExportFiles(tsx, tailwindTarget);

  const sdk = (await import("@stackblitz/sdk")).default;
  sdk.openProject(
    {
      title: `AI UI Export (${tailwindTarget.toUpperCase()})`,
      description:
        "Generated by AI UI Generator — React + Vite + Tailwind export",
      template: "node",
      files,
    },
    {
      openFile: "src/App.tsx",
      newWindow: true,
    },
  );
}
