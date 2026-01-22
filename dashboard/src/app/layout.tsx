import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
  title: "Claudometer",
  description: "Team leaderboards for Claude Code",
  metadataBase: new URL("https://claudometer.com"),
  openGraph: {
    title: "Claudometer",
    description: "Team leaderboards for Claude Code",
    images: [
      {
        url: "/og-image-combined.png",
        width: 1200,
        height: 630,
        alt: "Claudometer - Team leaderboards for Claude Code",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Claudometer",
    description: "Team leaderboards for Claude Code",
    images: ["/og-image-combined.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
