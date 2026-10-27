import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const terminal = localFont({
  src: "../../public/fonts/vt323-latin.woff2",
  variable: "--font-terminal",
  display: "swap",
});
const mono = localFont({
  src: "../../public/fonts/ibm-plex-mono-latin.woff2",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Upgrade Oracle — Bitcoin Cash Contract Doctor",
  description:
    "Compile CashScript, examine pinned BCH upgrade evidence, and seal a report with your wallet. Built for BCH BLAZE 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${terminal.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
