import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ResumeTemplate } from '../stores/template';
import {
  AnyResumeBlock,
  CompactHeader,
  CompactSidebar,
  FullHeader,
  FullSidebar,
  ResumeInfo,
  renderBlockContent,
  resumeStyle,
} from '../components/preview/resumeBlocks';
import { paginateBlocks } from '../utils/pagination';

/** A4 纸张固定按 96dpi 的像素尺寸测量，导出时与 PDF 页面一一对应 */
export const SHEET_WIDTH = 794;
export const SHEET_HEIGHT = 1123;
export const ARTICLE_PADDING = 32;
const MM_TO_PX = SHEET_WIDTH / 210;

export interface PaginatedPage {
  blocks: AnyResumeBlock[];
  isFirst: boolean;
  index: number;
}

type MeasureKind = 'block' | 'full-header' | 'compact-header' | 'footer';

interface MeasureEntry {
  kind: MeasureKind;
  block?: AnyResumeBlock;
}

interface MeasuredHeights {
  /** key: 块 id => 内容自身高度（不含块间距） */
  blocks: Record<string, number>;
  fullHeader: number;
  compactHeader: number;
  footer: number;
}

interface UsePaginationArgs {
  template: ResumeTemplate;
  fontSize: number;
  margin: number;
  blocks: AnyResumeBlock[];
  info: ResumeInfo;
}

interface UsePaginationResult {
  pages: PaginatedPage[];
  /** 离屏测量层，必须随页面一起渲染，不占布局、不可见 */
  measureStage: ReactNode;
}

/**
 * 按当前字号与页边距，基于真实 DOM 测量每页容量后分页：
 * - 工作/项目条目（原子块）永远不会跨页拆开；
 * - 模块标题始终跟随第一个内容块，不会孤立在页尾；
 * - 每页页眉重复姓名和联系方式，第二页起预留并显示页码；
 * - 分页结果只由简历内容、模板、字号、页边距推导，因此复制简历、
 *   重新打开、调整页边距或字号后都能得到一致且即时更新的结果。
 */
export function usePagination({ template, fontSize, margin, blocks, info }: UsePaginationArgs): UsePaginationResult {
  const measureRootRef = useRef<HTMLDivElement | null>(null);
  const [heights, setHeights] = useState<MeasuredHeights | null>(null);
  const [fontsReady, setFontsReady] = useState(0);

  const isSidebar = template.layout === 'sidebar';
  const sheetPadding = margin * MM_TO_PX;
  const contentWidth = SHEET_WIDTH - sheetPadding * 2 - ARTICLE_PADDING * 2;
  const mainWidth = isSidebar ? contentWidth - 190 - 32 : contentWidth;

  const entries = useMemo<MeasureEntry[]>(
    () => [
      ...blocks.map<MeasureEntry>((block) => ({ kind: 'block', block })),
      { kind: 'full-header' },
      { kind: 'compact-header' },
      { kind: 'footer' },
    ],
    [blocks],
  );

  useLayoutEffect(() => {
    const measure = () => {
      const root = measureRootRef.current;
      if (!root) {
        return;
      }
      const rowEls = Array.from(root.querySelectorAll<HTMLElement>('[data-measure]'));
      if (rowEls.length !== entries.length) {
        return;
      }
      const next: MeasuredHeights = { blocks: {}, fullHeader: 0, compactHeader: 0, footer: 0 };
      entries.forEach((entry, index) => {
        const height = rowEls[index].offsetHeight;
        if (entry.kind === 'block' && entry.block) {
          next.blocks[entry.block.id] = height;
        } else if (entry.kind === 'full-header') {
          next.fullHeader = height;
        } else if (entry.kind === 'compact-header') {
          next.compactHeader = height;
        } else {
          next.footer = height;
        }
      });

      setHeights((previous) => {
        const signature = (value: MeasuredHeights) =>
          `${value.fullHeader.toFixed(2)}|${value.compactHeader.toFixed(2)}|${value.footer.toFixed(2)}|` +
          blocks.map((block) => (value.blocks[block.id] ?? 0).toFixed(2)).join(',');
        // 数值未变化时返回原引用，避免无意义的重渲染（也避免与离屏测量互相触发）
        if (previous && signature(previous) === signature(next)) {
          return previous;
        }
        return next;
      });
    };

    // 首帧先测一次（兜底系统字体）
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener('load', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('load', measure);
    };
    // 页边距(宽度)、字号、模板、信息或内容变化都会改变行高/折行，必须重新测量分页
  }, [entries, blocks, fontsReady, contentWidth, mainWidth, fontSize, template, info]);

  // webfont 加载可能晚于首帧并改变行高；只在挂载时订阅一次，
  // 就绪后推动一次重测即可，避免对已 resolve 的 ready promise 重复订阅造成死循环。
  useLayoutEffect(() => {
    let cancelled = false;
    if (document.fonts) {
      document.fonts.ready.then(() => {
        if (!cancelled) {
          setFontsReady((value) => value + 1);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const pages = useMemo<PaginatedPage[]>(() => {
    if (!heights) {
      return [];
    }

    const innerHeight = SHEET_HEIGHT - sheetPadding * 2 - ARTICLE_PADDING * 2;
    // 侧栏版式的页眉与正文同处一个网格行，不额外占用纵向容量；
    // 经典版式页眉（首页完整 / 续页精简）独占一行，需从容量中扣除。
    const headerCost = isSidebar ? 0 : heights.fullHeader;
    const compactHeaderCost = isSidebar ? 0 : heights.compactHeader;
    const footerCost = heights.footer;

    // 第一遍：假设只有一页（无页码槽位、无续页页眉）。放得下就直接是一页，
    // 避免“只差一点点”的内容被无谓挤到第二页。
    const onePage = paginateBlocks({
      blocks,
      blockHeights: heights.blocks,
      firstCapacity: innerHeight - headerCost,
      laterCapacity: innerHeight - compactHeaderCost,
    });
    if (onePage.length === 1) {
      return onePage.map<PaginatedPage>((page, index) => ({
        blocks: blocks.slice(page.start, page.end),
        isFirst: index === 0,
        index,
      }));
    }

    // 第二遍：确实超过一页。每页预留等高页码槽位，续页扣除精简页眉。
    const packed = paginateBlocks({
      blocks,
      blockHeights: heights.blocks,
      firstCapacity: innerHeight - headerCost - footerCost,
      laterCapacity: innerHeight - compactHeaderCost - footerCost,
    });

    return packed.map<PaginatedPage>((page, index) => ({
      blocks: blocks.slice(page.start, page.end),
      isFirst: index === 0,
      index,
    }));
  }, [heights, blocks, sheetPadding, isSidebar]);

  const measureStage = (
    <div
      ref={measureRootRef}
      aria-hidden
      style={{ position: 'absolute', left: -99999, top: 0, visibility: 'hidden', pointerEvents: 'none' }}
    >
      <article
        style={{ ...(resumeStyle(template, fontSize) as React.CSSProperties), width: SHEET_WIDTH, padding: ARTICLE_PADDING }}
      >
        {entries.map((entry, index) => {
          const rowKey = `m-${entry.kind}-${entry.block?.id ?? index}`;

          if (entry.kind === 'block' && entry.block) {
            const block = entry.block;
            if (isSidebar) {
              return (
                <div
                  className="grid grid-cols-[190px_1fr] gap-8"
                  data-measure="block"
                  key={rowKey}
                  style={{ overflow: 'hidden', width: contentWidth }}
                >
                  <div />
                  <div style={{ width: mainWidth }}>{renderBlockContent(block, template)}</div>
                </div>
              );
            }
            return (
              <div data-measure="block" key={rowKey} style={{ overflow: 'hidden', width: contentWidth }}>
                {renderBlockContent(block, template)}
              </div>
            );
          }

          if (entry.kind === 'full-header') {
            if (isSidebar) {
              return (
                <div
                  className="grid grid-cols-[190px_1fr] gap-8"
                  data-measure="full-header"
                  key={rowKey}
                  style={{ overflow: 'hidden', width: contentWidth }}
                >
                  <FullSidebar info={info} template={template} />
                  <div />
                </div>
              );
            }
            return (
              <div data-measure="full-header" key={rowKey} style={{ overflow: 'hidden', width: contentWidth }}>
                <FullHeader info={info} template={template} />
              </div>
            );
          }

          if (entry.kind === 'compact-header') {
            if (isSidebar) {
              return (
                <div
                  className="grid grid-cols-[190px_1fr] gap-8"
                  data-measure="compact-header"
                  key={rowKey}
                  style={{ overflow: 'hidden', width: contentWidth }}
                >
                  <CompactSidebar info={info} template={template} />
                  <div />
                </div>
              );
            }
            return (
              <div data-measure="compact-header" key={rowKey} style={{ overflow: 'hidden', width: contentWidth }}>
                <CompactHeader info={info} accent={template.accent} />
              </div>
            );
          }

          return (
            <div data-measure="footer" key={rowKey} style={{ overflow: 'hidden', width: contentWidth }}>
              {/* 与页面渲染保持一致的固定页码槽位高度 */}
              <div style={{ height: 34 }} />
            </div>
          );
        })}
      </article>
    </div>
  );

  return { pages, measureStage };
}
