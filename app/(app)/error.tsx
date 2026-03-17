"use client";

import Link from "next/link";

export default function AppError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="text-center max-w-md px-6">
        <h2 className="text-lg font-semibold text-red-400 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          An error occurred while loading this page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
