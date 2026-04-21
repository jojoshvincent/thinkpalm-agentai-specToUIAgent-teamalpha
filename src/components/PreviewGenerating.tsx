"use client";

type Props = {
  agentLine: string;
  attemptText: string | null;
};

export function PreviewGenerating({ agentLine, attemptText }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500"
        aria-hidden
      />
      <p className="sr-only">Generating preview</p>
      <div role="status" aria-live="polite" className="mt-5 max-w-sm">
        <p className="text-sm font-medium text-gray-900">{agentLine}</p>
        {attemptText ? (
          <p className="mt-2 text-xs text-gray-500">{attemptText}</p>
        ) : null}
      </div>
    </div>
  );
}
