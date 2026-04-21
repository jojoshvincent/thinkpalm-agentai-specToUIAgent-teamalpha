import { describe, expect, it } from "vitest";
import { buildViteExportFiles } from "@/lib/export/stackblitz";

const validTsx = `
export default function GeneratedPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <h1 className="text-3xl font-semibold tracking-tight text-center">Hello</h1>
      <button className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none">
        Click
      </button>
    </main>
  );
}
`;

describe("buildViteExportFiles", () => {
  it("includes React import in generated App.tsx", () => {
    const files = buildViteExportFiles(validTsx, "v4");
    expect(files["src/App.tsx"]).toContain('import React from "react";');
    expect(files["src/App.tsx"]).toContain("function GeneratedPage");
  });

  it("rejects framework-specific imports", () => {
    const badTsx = `
import Link from "next/link";
export default function GeneratedPage() { return <div />; }
`;
    expect(() => buildViteExportFiles(badTsx, "v4")).toThrow(
      /framework-specific imports/i,
    );
  });
});
