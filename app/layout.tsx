import type { Metadata, Viewport } from "next";
import { Fredoka, Geist } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import RocketLogo from "@/components/RocketLogo";
import { openGraph, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const body = Geist({ variable: "--font-body", subsets: ["latin"] });
const heading = Fredoka({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — quick, free browser games`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: openGraph(
    `${SITE_NAME} — quick, free browser games`,
    SITE_DESCRIPTION,
    "/",
  ),
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1026" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="btn-primary sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to content
        </a>
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3"
          >
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg font-display text-xl font-semibold"
            >
              <RocketLogo className="size-8" />
              RocketGame
            </Link>
            <ul className="flex items-center gap-1 text-sm font-medium">
              <li>
                <Link
                  href="/#games"
                  className="rounded-lg px-3 py-2 hover:bg-surface-2"
                >
                  Games
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="rounded-lg px-3 py-2 hover:bg-surface-2"
                >
                  About
                </Link>
              </li>
            </ul>
          </nav>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-line text-sm text-muted">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6">
            <p>
              © {new Date().getFullYear()} RocketGame · Free games, no sign-up.
            </p>
            <Link
              href="/about"
              className="rounded underline-offset-4 hover:underline"
            >
              About &amp; credits
            </Link>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
