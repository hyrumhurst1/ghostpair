import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghostpair — AI pair programmer that watches you type",
  description:
    "Browser-based editor with real-time, debounced AI bug detection powered by Claude Haiku 4.5.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        {children}
      </body>
    </html>
  );
}
