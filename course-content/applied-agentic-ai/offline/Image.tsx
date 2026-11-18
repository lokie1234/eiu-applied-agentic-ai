import type { CSSProperties } from "react";

// Keep original dimensions, CSS classes and fill behavior without Next's server.
type Props = {
  src: string; alt: string; width?: number; height?: number;
  fill?: boolean; className?: string; style?: CSSProperties;
};
export default function OfflineImage({ src, alt, width, height, fill, className, style }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- Self-contained offline asset.
  return <img src={src} alt={alt} width={width} height={height} className={className}
    style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style} />;
}
