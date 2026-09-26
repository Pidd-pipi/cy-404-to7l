import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface PdfExportOptions {
  filename: string;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Exports every `[data-resume-page]` element inside `element` as one A4 page,
 * preserving the on-screen pagination. Falls back to a single-page capture of
 * `element` itself when no page markers are found.
 */
export async function exportElementToPdf(element: HTMLElement, options: PdfExportOptions): Promise<void> {
  const markedPages = Array.from(element.querySelectorAll<HTMLElement>('[data-resume-page]'));
  const targets = markedPages.length > 0 ? markedPages : [element];

  // The preview scales pages with a CSS transform; flatten it while capturing
  // so html2canvas renders every page at its natural A4 size. Sheet shadows are
  // an on-screen affordance (and use color functions html2canvas cannot parse),
  // so they are removed from the captured pages as well.
  const scaleWrapper = element.closest<HTMLElement>('[data-resume-scale]');
  const previousTransform = scaleWrapper?.style.transform ?? '';
  if (scaleWrapper) {
    scaleWrapper.style.transform = 'none';
  }
  const previousShadows = targets.map((target) => {
    const previous = target.style.boxShadow;
    target.style.boxShadow = 'none';
    return previous;
  });

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let index = 0; index < targets.length; index += 1) {
      const canvas = await html2canvas(targets[index], {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      if (index > 0) {
        pdf.addPage();
      }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
    }
    pdf.save(options.filename);
  } finally {
    targets.forEach((target, index) => {
      target.style.boxShadow = previousShadows[index];
    });
    if (scaleWrapper) {
      scaleWrapper.style.transform = previousTransform;
    }
  }
}

