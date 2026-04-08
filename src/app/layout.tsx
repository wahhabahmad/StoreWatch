import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteNav } from "@/components/site-nav";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Storewatch — App Store & Play updates",
  description: "Watchlist-driven feed of App Store and Google Play releases (no paid APIs).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 print:bg-white print:text-black dark:bg-black dark:text-zinc-50">
        <SiteNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 print:max-w-none print:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
