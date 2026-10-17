import type { Metadata } from "next";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EIU · Interactive Learning Space",
  description: "AI learning, automation and interactive course experiences at EIU.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
