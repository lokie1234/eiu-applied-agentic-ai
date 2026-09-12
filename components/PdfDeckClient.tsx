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

type Props = { isAdmin: boolean };

export default function PdfDeckClient({ isAdmin }: Props) {
  return <PdfDeck isAdmin={isAdmin} />;
}
