import type { Metadata } from "next";
import Link from "next/link";
import { openGraph } from "@/lib/site";

const description =
  "About RocketGame: free, quick browser games with original art. Credits for fonts, sounds and other assets.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: openGraph("About RocketGame", description, "/about"),
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl font-semibold">About RocketGame</h1>
      <p className="text-lg text-muted">
        RocketGame is a small collection of quick, free browser games. Open the
        site, pick a game and play — no sign-up, no downloads and no ads in the
        way. Every game works with a keyboard and on touch screens.
      </p>

      <section aria-labelledby="privacy" className="space-y-2">
        <h2 id="privacy" className="font-display text-2xl font-semibold">
          Your data
        </h2>
        <p className="text-muted">
          Best scores and settings (such as sound on/off) are saved only in your
          own browser. We use privacy-friendly Vercel Analytics to count page
          views; it does not use cookies.
        </p>
      </section>

      <section aria-labelledby="credits" className="space-y-2">
        <h2 id="credits" className="font-display text-2xl font-semibold">
          Credits
        </h2>
        <p className="text-muted">
          All games are original implementations, and the RocketGame rocket is
          original art. Third-party assets:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            Fonts:{" "}
            <a
              className="underline underline-offset-4"
              href="https://fonts.google.com/specimen/Fredoka"
            >
              Fredoka
            </a>{" "}
            and{" "}
            <a
              className="underline underline-offset-4"
              href="https://fonts.google.com/specimen/Geist"
            >
              Geist
            </a>
            , SIL Open Font License 1.1.
          </li>
        </ul>
      </section>

      <Link href="/#games" className="btn-primary">
        Play a game
      </Link>
    </article>
  );
}
