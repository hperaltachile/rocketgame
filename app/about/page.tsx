import type { Metadata } from "next";
import Link from "next/link";
import { openGraph } from "@/lib/site";

const description =
  "RocketGame is inspired by the fun little games from Google. Every game is free, safe and kid-friendly, and runs right in your Chrome browser.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: openGraph("About RocketGame", description, "/about"),
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl font-semibold">
        Welcome to RocketGame! <span aria-hidden="true">🚀</span>
      </h1>
      <div className="space-y-4 text-lg text-muted">
        <p>
          RocketGame is inspired by the fun little games from Google, like the
          Chrome Dino game and Google Doodle games. We kept things simple, clean
          and easy to use, so kids everywhere can find a game fast and start
          playing.
        </p>
        <p>
          Every game here is free, safe and kid-friendly. There&apos;s nothing
          to download and no sign-up. The games run right in your Google Chrome
          browser, so you can play at school during recess, at lunch, or after
          you finish your work.
        </p>
        <p className="font-semibold text-text">
          Ready for liftoff? Pick a game and blast off!
        </p>
      </div>

      <Link href="/#games" className="btn-primary">
        Play a game
      </Link>

      <section aria-labelledby="safe" className="space-y-2">
        <h2 id="safe" className="font-display text-2xl font-semibold">
          Safe to play
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>No ads.</li>
          <li>No accounts, and no chat with strangers.</li>
          <li>
            Your best scores and settings stay on your own device. We never ask
            for your name or email.
          </li>
          <li>
            We only count visits to the site, with no cookies and nothing that
            tells us who you are.
          </li>
        </ul>
      </section>

      <section aria-labelledby="credits" className="space-y-2">
        <h2 id="credits" className="font-display text-2xl font-semibold">
          Credits
        </h2>
        <p className="text-muted">
          All games are original. The rocket logo, the game pictures and the
          sounds are made by us in code, and every character (like Bolt the
          robot goalie) is made up. Other things we use:
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

      <p className="border-t border-line pt-4 text-sm text-muted">
        RocketGame is an independent site. It is not made by or connected to
        Google. Google, Chrome and Google Doodle are trademarks of Google LLC.
      </p>
    </article>
  );
}
