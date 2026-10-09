import Link from "next/link";
import SectionOneHtmlSlide, { type SectionOneHtmlKind } from "@/components/section1/SectionOneHtmlSlide";
import SectionOneNativeSlide from "@/components/section1/SectionOneNativeSlide";
import SectionOneSlide14 from "@/components/section1/SectionOneSlide14";
import SectionTwoSlide from "@/components/section2/SectionTwoSlide";
import PrintTrigger from "@/components/PrintTrigger";
import styles from "./export-deck.module.css";

type SectionOneExportItem =
  | { kind: "native"; page: number }
  | { kind: "html"; slide: SectionOneHtmlKind }
  | { kind: "slide14" };

function buildSectionOneExportList(): SectionOneExportItem[] {
  const items: SectionOneExportItem[] = [];

  for (let pdfPage = 1; pdfPage <= 38; pdfPage += 1) {
    if (pdfPage === 10) continue;

    if (pdfPage === 3) {
      items.push({ kind: "html", slide: "slide3" });
    } else if (pdfPage === 4) {
      // Excluded: slide4 (idea submission form)
      continue;
    } else if (pdfPage === 14) {
      items.push({ kind: "slide14" });
    } else if (pdfPage === 38) {
      // Excluded: showcase (submission board)
      // Included: realtime-dashboard
      items.push({ kind: "html", slide: "realtime-dashboard" });
    } else {
      items.push({ kind: "native", page: pdfPage });
    }

    if (pdfPage === 34) {
      items.push({ kind: "html", slide: "deployment" });
    }

    if (pdfPage === 37) {
      items.push({ kind: "html", slide: "apply-idea" });
    }
  }

  // Excluded: quiz slide
  return items;
}

const SECTION_TWO_PAGES = Array.from({ length: 36 }, (_, index) => index + 1);

type Props = {
  searchParams: Promise<{ section?: string }>;
};

export default async function ExportDeckPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const sectionParam = resolvedParams.section || "section1";
  const isSection2 = sectionParam === "section2" || sectionParam === "2";

  const s1Items = buildSectionOneExportList();

  return (
    <div className={styles.exportContainer}>
      <header className={`${styles.topBar} ${styles.noPrint}`}>
        <span className={styles.topBarTitle}>
          {isSection2 ? "Section 2 Slides Deck" : "Section 1 Slides Deck"}
        </span>
        <span className={styles.topBarCount}>
          {isSection2 ? `${SECTION_TWO_PAGES.length} slides` : `${s1Items.length} slides`}
        </span>

        <div className={styles.sectionSwitch}>
          <Link
            href="/export-deck?section=section1"
            className={`${styles.switchLink} ${!isSection2 ? styles.switchLinkActive : ""}`}
          >
            Section 1
          </Link>
          <Link
            href="/export-deck?section=section2"
            className={`${styles.switchLink} ${isSection2 ? styles.switchLinkActive : ""}`}
          >
            Section 2
          </Link>
        </div>

        <PrintTrigger />
      </header>

      <main className={styles.deckPages}>
        {!isSection2 ? (
          s1Items.map((item, index) => (
            <div key={`s1-${index}`} className={styles.slidePrintPage}>
              {item.kind === "native" && (
                <SectionOneNativeSlide page={item.page} scale={1} isFinalState={true} />
              )}
              {item.kind === "slide14" && (
                <SectionOneSlide14 scale={1} />
              )}
              {item.kind === "html" && (
                <SectionOneHtmlSlide kind={item.slide} scale={1} isAdmin={false} />
              )}
            </div>
          ))
        ) : (
          SECTION_TWO_PAGES.map((pageNumber) => (
            <div key={`s2-${pageNumber}`} className={styles.slidePrintPage}>
              <SectionTwoSlide pageNumber={pageNumber} isFinalState={true} />
            </div>
          ))
        )}
      </main>
    </div>
  );
}

