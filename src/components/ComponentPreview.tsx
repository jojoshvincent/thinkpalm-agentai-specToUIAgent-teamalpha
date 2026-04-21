"use client";

import { useMemo } from "react";
import { buildPreviewSrcDoc } from "@/lib/preview/buildPreviewSrcDoc";

type Props = {
  tsx: string;
};

export function ComponentPreview({ tsx }: Props) {
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
      <div className="rounded-xl border border-amber-300/80 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        Preview could not be prepared: {error ?? "Unknown error"}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-inner dark:border-zinc-700 dark:bg-zinc-900">
      <iframe
        title="Generated UI preview"
        className="h-[min(70vh,720px)] w-full border-0 bg-white dark:bg-zinc-950"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={srcDoc}
      />
      <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Isolated preview uses the Tailwind CDN so all generated classes resolve. Your
        copied TSX still relies on your app&apos;s Tailwind build (safelist if needed).
      </p>
    </div>
  );
}
