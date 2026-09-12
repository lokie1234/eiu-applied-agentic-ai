"use client";

import dynamic from "next/dynamic";

const PdfDeck = dynamic(() => import("./PdfDeck"), {
  ssr: false,
  loading: () => (
    <div className="app-loading">
      <div className="loading-spinner" />
      <p>Loading presentation...</p>
    </div>
  ),
});

export default function PdfDeckClient() {
  return <PdfDeck />;
}
