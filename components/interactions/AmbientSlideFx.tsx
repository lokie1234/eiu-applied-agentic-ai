"use client";

type Props = {
  pageNumber: number;
};

export default function AmbientSlideFx({ pageNumber }: Props) {
  const variant = pageNumber % 3;

  return (
    <div
      className={`ambient-slide-fx ambient-slide-fx-${variant}`}
      aria-hidden="true"
    >
      <div className="ambient-corner-mesh">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="ambient-edge-signal ambient-edge-signal-a" />
      <div className="ambient-edge-signal ambient-edge-signal-b" />
      <div className="ambient-edge-signal ambient-edge-signal-c" />

      <div className="ambient-scan-line" />
    </div>
  );
}
