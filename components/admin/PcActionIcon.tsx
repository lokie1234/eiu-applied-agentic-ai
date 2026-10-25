export default function PcActionIcon({ direction }: { direction: "upload" | "download" }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={direction === "upload" ? "M12 16V3m-5 5 5-5 5 5" : "M12 3v13m-5-5 5 5 5-5"} />
    <path d="M4 16v5h16v-5" />
  </svg>;
}
