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
  title: "Upgrade Oracle — Know what breaks before it breaks",
  description:
    "A little foresight for your next npm install. GLM reads real release notes, finds affected lines in your code, and gives every breaking change an evidence receipt.",
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
