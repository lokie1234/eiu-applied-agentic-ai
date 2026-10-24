"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import SharedDeckFrame from "./SharedDeckFrame";
import EiuTemplateFrame from "./EiuTemplateFrame";
import HairlineLoading from "@/components/HairlineLoading";
import styles from "./UploadedSectionDeck.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export default function UploadedPdfDeck({ contentUrl, slideCount, courseTitle, sectionTitle, templateImage }: {
  contentUrl: string; slideCount: number | null; courseTitle: string; sectionTitle: string; templateImage: string;
}) {
  const [totalSlides, setTotalSlides] = useState(slideCount ?? 1);
  const [documentReady, setDocumentReady] = useState(false);
  return (
    <SharedDeckFrame
      courseTitle={courseTitle}
      sectionTitle={sectionTitle}
      totalSlides={totalSlides}
      navigationReady={documentReady}
      frameClassName={styles.frame}
      transitionClassName={styles.slide}
      renderSlideContainer={children => (
        <Document
          className={styles.pdfDocument}
          file={contentUrl}
          suspense={false}
          loading={<HairlineLoading contained label="Loading PDF" />}
          error={<div className={styles.message} role="alert">Unable to display this PDF.</div>}
          onLoadSuccess={({ numPages }) => { setTotalSlides(numPages); setDocumentReady(true); }}
        >{children}</Document>
      )}
      renderSlide={(pageNumber, renderWidth) => {
        const page = <Page className={styles.pdfPage} pageNumber={pageNumber}
          suspense={false}
          loading={<HairlineLoading contained label="Loading slide" />}
          error={<div className={styles.message} role="alert">Unable to display this slide.</div>}
          width={templateImage ? renderWidth * .888 : renderWidth}
          renderTextLayer={false} renderAnnotationLayer />;
        return templateImage
          ? <EiuTemplateFrame page={pageNumber} background={templateImage}>{page}</EiuTemplateFrame>
          : page;
      }}
    />
  );
}
