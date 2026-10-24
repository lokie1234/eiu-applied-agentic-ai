import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EIU · Interactive Learning Space",
  description: "AI learning, automation and interactive course experiences at EIU.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://apis.google.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://drive.google.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
