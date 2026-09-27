import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lost in space",
  description: "This page drifted out of orbit.",
};

export default function NotFound() {
  return (
    <section className="mx-auto max-w-lg py-12 text-center">
      <p aria-hidden="true" className="text-7xl">
        🛰️
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold">
        Lost in space
      </h1>
      <p className="mt-3 text-lg text-muted">
        We couldn&apos;t find that page. It may have drifted out of orbit.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to base
      </Link>
    </section>
  );
}
