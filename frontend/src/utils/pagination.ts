import { Education } from '../types/education';
import { Project } from '../types/project';
import { Resume, ResumeSection, ResumeSectionType } from '../types/resume';
import { Skill } from '../types/skill';
import { WorkExperience } from '../types/work-experience';

export const MM_TO_PX = 96 / 25.4;
export const A4_WIDTH_PX = 210 * MM_TO_PX;
export const A4_HEIGHT_PX = 297 * MM_TO_PX;

/** Inner padding (p-8) of the resume sheet inside the page margins. */
export const SHEET_PADDING_PX = 32;
export const SIDEBAR_WIDTH_PX = 190;
export const SIDEBAR_GAP_PX = 32;

/** Vertical rhythm shared by the continuous preview and the paginator. */
export const SECTION_GAP_PX = 20; // space-y-5 between sections
export const TITLE_GAP_PX = 12; // mb-3 below a section title
export const HEADER_GAP_PX = 28; // mb-7 below the full header
export const HEADER_GAP_EDITORIAL_PX = 32; // mb-8 below the editorial header
export const COMPACT_HEADER_GAP_PX = 24; // mb-6 below the repeated compact header
export const FOOTER_CLEARANCE_PX = 12; // breathing room above the page number

const ITEM_GAP_PX: Record<ResumeSectionType, number> = {
  summary: 0,
  work: 16, // space-y-4
  projects: 16, // space-y-4
  skills: 8, // grid gap-2
  education: 12, // space-y-3
};

export type ResumeBlock =
  | { key: string; type: 'section-title'; section: ResumeSection }
  | { key: string; type: 'summary'; section: ResumeSection; text: string }
  | { key: string; type: 'work'; section: ResumeSection; item: WorkExperience }
  | { key: string; type: 'project'; section: ResumeSection; item: Project }
  | { key: string; type: 'skill'; section: ResumeSection; item: Skill }
  | { key: string; type: 'education'; section: ResumeSection; item: Education };

/**
 * Flattens the enabled sections into an ordered list of atomic blocks.
 * Every work / project / skill / education entry becomes one unbreakable block.
 */
export function buildResumeBlocks(resume: Resume, profileSummary: string): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];

  resume.sections
    .filter((section) => section.enabled)
    .forEach((section) => {
      blocks.push({ key: `${section.id}:title`, type: 'section-title', section });

      switch (section.id) {
        case 'summary':
          blocks.push({ key: 'summary:text', type: 'summary', section, text: resume.summary || profileSummary });
          break;
        case 'work':
          resume.workExperiences.forEach((item) => {
            blocks.push({ key: `work:${item.id}`, type: 'work', section, item });
          });
          break;
        case 'projects':
          resume.projects.forEach((item) => {
            blocks.push({ key: `projects:${item.id}`, type: 'project', section, item });
          });
          break;
        case 'skills':
          resume.skills.forEach((item) => {
            blocks.push({ key: `skills:${item.id}`, type: 'skill', section, item });
          });
          break;
        case 'education':
          resume.educations.forEach((item) => {
            blocks.push({ key: `education:${item.id}`, type: 'education', section, item });
          });
          break;
      }
    });

  return blocks;
}

/** Gap above a block when it follows `previous`, mirroring the continuous preview rhythm. */
export function gapBeforeBlock(block: ResumeBlock, previous: ResumeBlock | null): number {
  if (!previous) {
    return 0;
  }
  if (block.type === 'section-title') {
    return SECTION_GAP_PX;
  }
  if (previous.type === 'section-title') {
    return TITLE_GAP_PX;
  }
  return ITEM_GAP_PX[block.section.id];
}

export interface PaginateOptions {
  /** Measured block heights in px, keyed by block key. */
  heights: Record<string, number>;
  /** Usable block-flow height in px for a 0-based page index. */
  capacity: (pageIndex: number) => number;
}

/**
 * Greedy pagination:
 * - item blocks are atomic and never split across pages;
 * - a section title is only placed where the block after it also fits, so a
 *   title never sits alone at the bottom of a page;
 * - a block taller than a whole page is placed on its own page, which keeps
 *   packing terminating and prevents blank pages.
 */
export function paginateBlocks(blocks: ResumeBlock[], options: PaginateOptions): ResumeBlock[][] {
  const { heights, capacity } = options;
  const pages: ResumeBlock[][] = [];
  let page: ResumeBlock[] = [];
  let used = 0;

  const heightOf = (block: ResumeBlock) => heights[block.key] ?? 0;

  blocks.forEach((block, index) => {
    const previous = page[page.length - 1] ?? null;
    let required = (previous ? gapBeforeBlock(block, previous) : 0) + heightOf(block);

    if (block.type === 'section-title' && index + 1 < blocks.length) {
      const next = blocks[index + 1];
      required += gapBeforeBlock(next, block) + heightOf(next);
    }

    if (page.length > 0 && used + required > capacity(pages.length) + 0.5) {
      pages.push(page);
      page = [];
      used = 0;
    }

    page.push(block);
    used += (page.length > 1 ? gapBeforeBlock(block, page[page.length - 2]) : 0) + heightOf(block);
  });

  if (page.length > 0 || pages.length === 0) {
    pages.push(page);
  }

  return pages;
}

