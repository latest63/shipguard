import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Inter, Roboto_Condensed } from "next/font/google";
import "@genlayer/transaction-kit-react/styles.css";
import "./globals.css";
import { Providers } from "./providers";

// Typography ported from the Ecosystem Fund Guardian lemon design system.
// Both families load as variable fonts, so the full weight range is
// self-hosted and preloaded — Inter covers headings (100-900) and
// JetBrains Mono covers body/UI (100-800), including the font-bold (700)
// used throughout. EFG loaded the same two from Google Fonts as static
// weights; this replaces that with no external request and no FOUT.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-inter",
  display: "swap",
});

// Departure-board display face: condensed grotesk for headings and round
// titles (see design/DIRECTION.md — "berth board"). Falls back metric-close
// to Arial Narrow / Liberation Sans Narrow where the webfont misses.
const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-roboto-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShipGuard",
  description:
    "AI-verified escrow for teams to raise capital. Deploy a raise with a condition, evidence URL, and close date. Backers lock GEN. AI validates at deadline. Pass = release funds. Fail = auto-refund.",
  manifest: "/site.webmanifest",
  metadataBase: new URL("https://shipguard-pad.vercel.app"),
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "any" }],
    apple: [{ url: "/favicon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "ShipGuard — AI-verified fundraising",
    description:
      "Deploy an escrowed raise with a condition and close date. Investors lock GEN. AI validates at deadline. Pass = release funds. Fail = auto-refund.",
    url: "https://shipguard-pad.vercel.app",
    siteName: "ShipGuard",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ShipGuard AI-verified fundraising on GenLayer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ShipGuard — AI-verified fundraising on GenLayer",
    description:
      "Deploy an escrowed raise with a condition and close date. Investors lock GEN. AI validates at deadline. Pass = release funds. Fail = auto-refund.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#d4ff00", // lemon
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} ${inter.variable} ${robotoCondensed.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}