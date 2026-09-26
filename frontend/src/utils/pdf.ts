import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SHEET_HEIGHT, SHEET_WIDTH } from '../hooks/usePagination';

export interface PdfExportOptions {
  filename: string;
}

/**
 * 将分页预览中的每张 A4 纸分别绘制到 PDF 的同一尺寸页面上，
 * 纸张内容（含页边距留白）铺满整页，超出一页的内容不会被裁切。
 */
export async function exportElementToPdf(rootElement: HTMLElement, options: PdfExportOptions): Promise<void> {
  const pages = Array.from(rootElement.querySelectorAll<HTMLElement>('[data-scale-inner]'));
  if (pages.length === 0) {
    throw new Error('没有找到可导出的预览页面');
  }

  const pdf = new jsPDF('p', 'mm', 'a4');

  for (let index = 0; index < pages.length; index += 1) {
    const pageElement = pages[index];
    const canvas = await html2canvas(pageElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      windowWidth: SHEET_WIDTH,
      windowHeight: SHEET_HEIGHT,
    });
    const imageData = canvas.toDataURL('image/png');

    if (index > 0) {
      pdf.addPage();
    }
    // A4: 210mm × 297mm，铺满整页
    pdf.addImage(imageData, 'PNG', 0, 0, 210, 297);
  }

  pdf.save(options.filename);
}
