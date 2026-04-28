import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RESINA",
  description: "RESINA landing page",
  icons: {
    icon: "/images/resina%20logo.png",
    shortcut: "/images/resina%20logo.png",
    apple: "/images/resina%20logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/images/resina%20logo.png" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/resina%20logo.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/resina%20logo.png" />
        <link rel="apple-touch-icon" href="/images/resina%20logo.png" />
        <link rel="shortcut icon" href="/images/resina%20logo.png" />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
