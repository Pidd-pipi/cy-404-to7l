import { forwardRef, useLayoutEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import { useProfileStore } from '../../stores/profile';
import { Resume } from '../../types/resume';
import {
  AnyResumeBlock,
  CompactHeader,
  CompactSidebar,
  FullHeader,
  FullSidebar,
  PageNumber,
  buildResumeBlocks,
  gapBeforeBlock,
  getResumeTemplate,
  renderBlockContent,
  resolveResumeInfo,
  resumeStyle,
} from './resumeBlocks';
import { ARTICLE_PADDING, PaginatedPage, SHEET_HEIGHT, SHEET_WIDTH, usePagination } from '../../hooks/usePagination';

interface A4PreviewProps {
  resume: Resume;
  margin: number;
  fontSize: number;
}

const MM_TO_PX = SHEET_WIDTH / 210;

function PageBlocks({ page, blocks, template }: { page: PaginatedPage; blocks: AnyResumeBlock[]; template: ReturnType<typeof getResumeTemplate> }) {
  return (
    <div>
      {page.blocks.map((block, pageBlockIndex) => {
        const globalIndex = blocks.findIndex((item) => item.id === block.id);
        return (
          <div key={block.id} style={{ marginTop: pageBlockIndex === 0 ? 0 : gapBeforeBlock(blocks, globalIndex) }}>
            {renderBlockContent(block, template)}
          </div>
        );
      })}
    </div>
  );
}

export const A4Preview = forwardRef<HTMLDivElement, A4PreviewProps>(({ resume, margin, fontSize }, ref) => {
  const template = getResumeTemplate(resume);
  const profile = useProfileStore((state) => state.profile);
  const info = useMemo(() => resolveResumeInfo(resume, profile), [resume, profile]);
  const blocks = useMemo(() => buildResumeBlocks(resume, profile), [resume, profile]);
  const { pages, measureStage } = usePagination({ template, fontSize, margin, blocks, info });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const isSidebar = template.layout === 'sidebar';
  const sheetPaddingPx = margin * MM_TO_PX;
  const totalPages = pages.length;
  const showPageNumbers = totalPages > 1;
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const update = () => {
      // 容器可用宽度减去外层 p-6 的留白
      const available = wrapper.clientWidth;
      setScale(Math.min(1, available / SHEET_WIDTH));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className="mx-auto w-full max-w-[842px]">
      {pages.length === 0 ? (
        <div
          className="mx-auto w-full bg-white shadow-panel"
          style={{ aspectRatio: '210 / 297' }}
          aria-label="正在分页"
        />
      ) : null}
      <div ref={ref} data-pdf-root>
        {pages.map((page) => {
          const scaledHeight = SHEET_HEIGHT * scale;
          const sheetStyle: CSSProperties = {
            width: SHEET_WIDTH,
            height: SHEET_HEIGHT,
            padding: sheetPaddingPx,
            overflow: 'hidden',
            // 响应式等比缩放，内部仍以固定 96dpi 像素布局，保证预览即导出
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          };
          const articleStyle: CSSProperties = {
            ...(resumeStyle(template, fontSize) as CSSProperties),
            height: '100%',
            padding: ARTICLE_PADDING,
          };

          const body = <PageBlocks page={page} blocks={blocks} template={template} />;
          // 多页时每页底部都预留等高的页码槽位（保证每页正文容量一致），
          // 页码文字只在第二页起显示
          const footer = showPageNumbers ? (
            <div style={{ height: 34, flexShrink: 0 }}>
              <PageNumber color={template.ink} index={page.index + 1} total={totalPages} />
            </div>
          ) : null;

          return (
            <div
              key={page.index}
              data-pdf-page
              data-scale-sheet
              style={{ width: SHEET_WIDTH * scale, height: scaledHeight, margin: '0 auto 24px' }}
            >
              <div className="bg-white shadow-panel" data-scale-inner style={sheetStyle}>
                {isSidebar ? (
                  <article style={articleStyle}>
                    <div className="grid h-full grid-cols-[190px_1fr] gap-8">
                      {page.isFirst ? (
                        <FullSidebar info={info} template={template} />
                      ) : (
                        <CompactSidebar info={info} template={template} />
                      )}
                      <main className="flex h-full min-w-0 flex-col">
                        <div className="min-h-0 flex-1">{body}</div>
                        {footer}
                      </main>
                    </div>
                  </article>
                ) : (
                  <article style={articleStyle} className="flex flex-col">
                    {page.isFirst ? (
                      <FullHeader info={info} template={template} />
                    ) : (
                      <CompactHeader info={info} accent={template.accent} />
                    )}
                    <div className="min-h-0 flex-1">{body}</div>
                    {footer}
                  </article>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* 离屏测量层：零尺寸裁剪，避免撑出横向滚动 */}
      <div aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        {measureStage}
      </div>
    </div>
  );
});

A4Preview.displayName = 'A4Preview';
