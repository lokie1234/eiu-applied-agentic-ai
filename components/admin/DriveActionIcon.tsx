import Image from "next/image";
import styles from "./DriveActionIcon.module.css";

export default function DriveActionIcon({ direction = "out" }: { direction?: "out" | "in" }) {
  const inbound = direction === "in";

  return (
    <span className={styles.icon} aria-hidden="true">
      <Image src="/branding/apps/google-drive.svg" width={21} height={21} alt="" />
      <span className={`${styles.badge} ${inbound ? styles.inbound : styles.outbound}`}>{inbound ? "U" : "S"}</span>
    </span>
  );
}
