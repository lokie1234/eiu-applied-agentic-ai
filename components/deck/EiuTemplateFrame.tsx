import type { ReactNode } from "react";
import styles from "./UploadedSectionDeck.module.css";

export default function EiuTemplateFrame({ page, children, background = "/templates/eiu-business-v1/background.png" }: { page: number; children: ReactNode; background?: string }) {
  return <div className={styles.templateFrame} style={{ backgroundImage: `url(${JSON.stringify(background)})` }}>
    {/* The supplied template is preserved as one lossless background. */}
    <div className={styles.templateContent}>{children}</div>
    <span className={styles.templateNumber} aria-label={`Slide ${page}`}>{page}</span>
  </div>;
}
