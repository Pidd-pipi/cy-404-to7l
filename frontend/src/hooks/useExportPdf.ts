import { RefObject, useCallback, useState } from 'react';
import { exportElementToPdf } from '../utils/pdf';

interface RestorableStyle {
  element: HTMLElement;
  width: string;
  height: string;
  transform: string;
}

export function useExportPdf(elementRef: RefObject<HTMLElement>) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = useCallback(
    async (filename: string) => {
      const root =
        elementRef.current?.closest('[data-pdf-root]') ??
        (elementRef.current?.hasAttribute?.('data-pdf-root') ? elementRef.current : null);
      if (!root) {
        setError('没有找到可导出的预览区域');
        return;
      }

      // 导出时临时取消响应式缩放（外层占位尺寸与内层 transform 都还原），
      // 按纸张原始像素逐页渲染，完成后恢复，避免把缩放或裁切带入 PDF。
      const restored: RestorableStyle[] = [];
      const sheets = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-page]'));
      const override = (element: HTMLElement, width?: string, height?: string, transform?: string) => {
        restored.push({
          element,
          width: element.style.width,
          height: element.style.height,
          transform: element.style.transform,
        });
        if (width !== undefined) element.style.width = width;
        if (height !== undefined) element.style.height = height;
        if (transform !== undefined) element.style.transform = transform;
      };

      sheets.forEach((sheet) => {
        override(sheet, '794px', '1123px');
        const inner = sheet.querySelector<HTMLElement>('[data-scale-inner]');
        if (inner) {
          override(inner, undefined, undefined, 'none');
        }
      });

      setIsExporting(true);
      setError(null);
      try {
        await exportElementToPdf(root as HTMLElement, { filename });
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : '导出失败');
      } finally {
        restored.forEach((item) => {
          item.element.style.width = item.width;
          item.element.style.height = item.height;
          item.element.style.transform = item.transform;
        });
        setIsExporting(false);
      }
    },
    [elementRef],
  );

  return { exportPdf, isExporting, error };
}
