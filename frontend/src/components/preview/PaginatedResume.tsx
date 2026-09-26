import { forwardRef, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useProfileStore } from '../../stores/profile';
import { getTemplateById, ResumeTemplate } from '../../stores/template';
import { Resume } from '../../types/resume';
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  buildResumeBlocks,
  COMPACT_HEADER_GAP_PX,
  FOOTER_CLEARANCE_PX,
  gapBeforeBlock,
  HEADER_GAP_EDITORIAL_PX,
  HEADER_GAP_PX,
  MM_TO_PX,
  paginateBlocks,
  ResumeBlock,
  SHEET_PADDING_PX,
  SIDEBAR_GAP_PX,
  SIDEBAR_WIDTH_PX,
} from '../../utils/pagination';
import {
  EducationItemBlock,
  PageFooter,
  ProjectItemBlock,
  ResumeHeaderCompact,
  ResumeHeaderFull,
  ResumeSidebar,
  resolveResumeInfo,
  resumeContentStyle,
  SectionTitle,
  SkillItemBlock,
  SummaryBlock,
  WorkItemBlock,
} from './blocks';

/** Vertical spacing between page sheets in the on-screen preview. */
const PAGE_GAP_PX = 24;

const MEASURE_HEADER_FULL = 'header:full';
const MEASURE_HEADER_COMPACT = 'header:compact';
const MEASURE_FOOTER = 'footer';

interface PaginatedResumeProps {
  resume: Resume;
  template?: ResumeTemplate;
  /** Page margin in mm. */
  margin: number;
  fontSize: number;
}

function renderBlock(block: ResumeBlock, template: ResumeTemplate): ReactNode {
  switch (block.type) {
    case 'section-title':
      return <SectionTitle title={block.section.title} accent={template.accent} />;
    case 'summary':
      return <SummaryBlock text={block.text} />;
    case 'work':
      return <WorkItemBlock item={block.item} accent={template.accent} />;
    case 'project':
      return <ProjectItemBlock item={block.item} accent={template.accent} />;
    case 'skill':
      return <SkillItemBlock item={block.item} accent={template.accent} />;
    case 'education':
      return <EducationItemBlock item={block.item} />;
    default:
      return null;
  }
}

/** Renders one page's blocks with the same gap model the paginator used. */
function BlockFlow({ blocks, template }: { blocks: ResumeBlock[]; template: ResumeTemplate }) {
  return (
    <div>
      {blocks.map((block, index) => {
        const gap = index > 0 ? gapBeforeBlock(block, blocks[index - 1]) : 0;
        return (
          <div key={block.key} style={gap > 0 ? { marginTop: gap } : undefined}>
            {renderBlock(block, template)}
          </div>
        );
      })}
    </div>
  );
}

function areHeightsEqual(previous: Record<string, number> | null, next: Record<string, number>): boolean {
  if (!previous) {
    return false;
  }
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }
  return nextKeys.every((key) => Math.abs((previous[key] ?? 0) - next[key]) < 0.5);
}

/**
 * Renders a resume as a stack of fixed-size A4 pages. Block heights are
 * measured in a hidden probe rendered at the exact content width, then packed
 * into pages by `paginateBlocks`; any change to margin, font size, template or
 * content re-measures and re-paginates.
 */
export const PaginatedResume = forwardRef<HTMLDivElement, PaginatedResumeProps>(function PaginatedResume(
  { resume, template = getTemplateById(resume.templateId), margin, fontSize },
  ref,
) {
  const profile = useProfileStore((state) => state.profile);
  const info = useMemo(() => resolveResumeInfo(resume, profile), [resume, profile]);
  const blocks = useMemo(() => buildResumeBlocks(resume, profile.summary), [resume, profile.summary]);

  const isSidebar = template.layout === 'sidebar';
  const marginPx = margin * MM_TO_PX;
  const contentWidth =
    A4_WIDTH_PX - 2 * marginPx - 2 * SHEET_PADDING_PX - (isSidebar ? SIDEBAR_WIDTH_PX + SIDEBAR_GAP_PX : 0);
  const sheetContentHeight = A4_HEIGHT_PX - 2 * marginPx - 2 * SHEET_PADDING_PX;

  // Re-measure once web fonts arrive: font metrics change line wrapping.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) {
            setFontsReady(true);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const measureRef = useRef<HTMLDivElement | null>(null);
  const [heights, setHeights] = useState<Record<string, number> | null>(null);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) {
      return;
    }
    const next: Record<string, number> = {};
    root.querySelectorAll('[data-measure]').forEach((node) => {
      const key = node.getAttribute('data-measure');
      if (key) {
        next[key] = node.getBoundingClientRect().height;
      }
    });
    setHeights((previous) => (areHeightsEqual(previous, next) ? previous : next));
  }, [blocks, info, contentWidth, fontSize, template, fontsReady]);

  const pages = useMemo(() => {
    if (!heights) {
      return null;
    }
    const fullHeaderHeight =
      (heights[MEASURE_HEADER_FULL] ?? 0) + (template.layout === 'editorial' ? HEADER_GAP_EDITORIAL_PX : HEADER_GAP_PX);
    const compactHeaderHeight = (heights[MEASURE_HEADER_COMPACT] ?? 0) + COMPACT_HEADER_GAP_PX;
    const footerReserve = (heights[MEASURE_FOOTER] ?? 0) + FOOTER_CLEARANCE_PX;

    return paginateBlocks(blocks, {
      heights,
      capacity: (pageIndex) => {
        let capacity = sheetContentHeight;
        if (!isSidebar) {
          capacity -= pageIndex === 0 ? fullHeaderHeight : compactHeaderHeight;
        }
        if (pageIndex > 0) {
          capacity -= footerReserve;
        }
        return capacity;
      },
    });
  }, [blocks, heights, isSidebar, sheetContentHeight, template.layout]);

  // Scale the fixed-size pages to fit the available preview width.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const update = () => {
      if (node.clientWidth > 0) {
        setScale(Math.min(1, node.clientWidth / A4_WIDTH_PX));
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pageCount = pages?.length ?? 1;
  const stackHeight = pageCount * A4_HEIGHT_PX + (pageCount - 1) * PAGE_GAP_PX;
  const contentStyle = resumeContentStyle(template, fontSize);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden measurement probe: same width and font context as a page column. */}
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden">
        <div ref={measureRef} style={{ ...contentStyle, width: contentWidth }}>
          <div data-measure={MEASURE_HEADER_FULL}>
            <ResumeHeaderFull info={info} template={template} />
          </div>
          <div data-measure={MEASURE_HEADER_COMPACT}>
            <ResumeHeaderCompact info={info} template={template} />
          </div>
          <div data-measure={MEASURE_FOOTER}>
            <PageFooter page={2} total={2} />
          </div>
          {blocks.map((block) => (
            <div key={block.key} data-measure={block.key}>
              {renderBlock(block, template)}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto" style={{ width: A4_WIDTH_PX * scale, height: stackHeight * scale }}>
        <div
          ref={ref}
          data-resume-scale
          style={{ width: A4_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {pages
            ? pages.map((pageBlocks, pageIndex) => (
                <div
                  key={pageIndex}
                  data-resume-page
                  className="relative overflow-hidden shadow-panel"
                  style={{
                    width: A4_WIDTH_PX,
                    height: A4_HEIGHT_PX,
                    padding: `${margin}mm`,
                    marginBottom: pageIndex < pageCount - 1 ? PAGE_GAP_PX : 0,
                    backgroundColor: template.paper,
                  }}
                >
                  <article className="relative h-full p-8" style={contentStyle}>
                    {isSidebar ? (
                      <div className="grid h-full grid-cols-[190px_1fr] gap-8">
                        <ResumeSidebar info={info} template={template} />
                        <main>
                          <BlockFlow blocks={pageBlocks} template={template} />
                        </main>
                      </div>
                    ) : (
                      <>
                        {pageIndex === 0 ? (
                          <ResumeHeaderFull
                            className={template.layout === 'editorial' ? 'mb-8' : 'mb-7'}
                            info={info}
                            template={template}
                          />
                        ) : (
                          <ResumeHeaderCompact className="mb-6" info={info} template={template} />
                        )}
                        <BlockFlow blocks={pageBlocks} template={template} />
                      </>
                    )}
                    {pageIndex > 0 ? (
                      <PageFooter
                        className="absolute bottom-0 left-0 right-0"
                        page={pageIndex + 1}
                        total={pageCount}
                      />
                    ) : null}
                  </article>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
});

PaginatedResume.displayName = 'PaginatedResume';

