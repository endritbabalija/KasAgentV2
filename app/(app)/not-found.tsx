import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">Not found</h2>
        <p className="text-sm text-zinc-500 mb-4">
          This page doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
