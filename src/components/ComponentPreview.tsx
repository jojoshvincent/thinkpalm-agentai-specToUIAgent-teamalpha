"use client";

import { useMemo } from "react";
import { buildPreviewSrcDoc } from "@/lib/preview/buildPreviewSrcDoc";

type Props = {
  tsx: string;
  iframeHeightClass?: string;
};

export function ComponentPreview({ tsx, iframeHeightClass }: Props) {
  const { srcDoc, error } = useMemo(() => {
    try {
      return { srcDoc: buildPreviewSrcDoc(tsx), error: null as string | null };
    } catch (e) {
      return {
        srcDoc: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [tsx]);

  if (error || !srcDoc) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Preview could not be prepared: {error ?? "Unknown error"}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
      <iframe
        title="Generated UI preview"
        className={`w-full border-0 bg-white ${iframeHeightClass ?? "h-[min(70vh,720px)]"}`}
        sandbox="allow-scripts allow-same-origin"
        srcDoc={srcDoc}
      />
      <p className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Preview uses the Tailwind CDN in an isolated frame. Copied TSX targets your
        app build (safelist if needed).
      </p>
    </div>
  );
}
