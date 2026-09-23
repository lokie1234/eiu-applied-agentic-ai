import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./WorkshopLaunchButton.module.css";

const WORKSHOP_APPS = [
  {
    name: "Gemini",
    href: "https://gemini.google.com/",
    icon: "/branding/apps/google-gemini.svg",
    tone: "gemini",
  },
  {
    name: "Google Drive",
    href: "https://drive.google.com/",
    icon: "/branding/apps/google-drive.svg",
    tone: "drive",
  },
  {
    name: "Demo app",
    href: "https://script.google.com/macros/s/AKfycby9d72k7VKLjHCDS5FBvppIA179bpO9jy9RrpeAhVha7W5XDvakoBttna2jszYGU3-yWQ/exec",
    icon: "/branding/apps/google-apps-script.svg",
    tone: "appsScript",
  },
] as const;

export default function WorkshopLaunchButton({
  slideWidth,
  showDemoApp = false,
}: {
  slideWidth: number;
  showDemoApp?: boolean;
}) {
  const dockStyle = { "--slide-width": `${slideWidth}px` } as CSSProperties;
  const visibleApps = showDemoApp
    ? WORKSHOP_APPS
    : WORKSHOP_APPS.filter((app) => app.name !== "Demo app");

  return (
    <div className={styles.dock} style={dockStyle}>
      <p className={styles.hint}>
        <span>Giữ phím</span>
        <kbd>Ctrl</kbd>
        <span>và click</span>
      </p>

      <div className={styles.actions}>
        {visibleApps.map((app) => (
          <a
            key={app.name}
            className={`${styles.button} ${styles[app.tone]}`}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            data-interactive="true"
            title={`Mở ${app.name}`}
          >
            <span className={styles.icon} aria-hidden="true">
              <Image src={app.icon} alt="" width={34} height={34} />
            </span>
            <span className={styles.text}>
              <strong>{app.name}</strong>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
