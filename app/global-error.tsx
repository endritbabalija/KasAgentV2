"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-zinc-100 flex items-center justify-center min-h-screen font-sans">
        <div className="text-center max-w-md px-6">
          <h1 className="text-lg font-semibold text-red-400 mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
