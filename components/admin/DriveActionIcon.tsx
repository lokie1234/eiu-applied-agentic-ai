import Image from "next/image";
import styles from "./DriveActionIcon.module.css";

export default function DriveActionIcon({ direction = "out" }: { direction?: "out" | "in" }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      <Image src="/branding/apps/google-drive.svg" width={21} height={21} alt="" />
      <svg className={direction === "in" ? styles.inbound : styles.outbound} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d={direction === "in" ? "m12 4-8 8m0-6v6h6" : "m4 12 8-8m-6 0h6v6"} />
      </svg>
    </span>
  );
}
