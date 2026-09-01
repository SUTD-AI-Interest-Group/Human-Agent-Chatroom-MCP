import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commonroom — Human + agent co-working",
  description: "An ephemeral shared room for people and their personal AI agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
