import { CSSProperties, ReactNode } from 'react';
import { useProfileStore } from '../../stores/profile';
import { getTemplateById, ResumeTemplate } from '../../stores/template';
import { educationLevelLabels, skillCategoryLabels, skillLevelLabels } from '../../types/enums';
import { Profile } from '../../types/profile';
import { Resume } from '../../types/resume';
import { formatDateRange } from '../../utils/format';

export type ResumeBlockType =
  | 'summary'
  | 'section-title'
  | 'work-item'
  | 'project-item'
  | 'skills'
  | 'education';

export interface ResumeBlock {
  id: string;
  type: ResumeBlockType;
  /** 模块标题块始终与后面的第一个内容块保持同页，避免标题孤立在页尾 */
  attachNext: boolean;
}

export interface SummaryBlock extends ResumeBlock {
  type: 'summary';
  text: string;
}

export interface SectionTitleBlock extends ResumeBlock {
  type: 'section-title';
  title: string;
}

export interface WorkItemBlock extends ResumeBlock {
  type: 'work-item';
  data: Resume['workExperiences'][number];
}

export interface ProjectItemBlock extends ResumeBlock {
  type: 'project-item';
  data: Resume['projects'][number];
}

export interface SkillsBlock extends ResumeBlock {
  type: 'skills';
  data: Resume['skills'];
}

export interface EducationBlock extends ResumeBlock {
  type: 'education';
  data: Resume['educations'];
}

export type AnyResumeBlock =
  | SummaryBlock
  | SectionTitleBlock
  | WorkItemBlock
  | ProjectItemBlock
  | SkillsBlock
  | EducationBlock;

export interface ResumeInfo {
  fullName: string;
  headline: string;
  phone: string;
  email: string;
  location: string;
  website: string;
  avatarUrl: string;
}

export interface ContactParts {
  phone: string;
  email: string;
  location: string;
  website: string;
}

/** 合并简历内基本信息与全局个人资料 */
export function resolveResumeInfo(resume: Resume, profile: Profile = useProfileStore.getState().profile): ResumeInfo {
  return {
    fullName: resume.basicInfo.fullName || profile.fullName,
    headline: resume.basicInfo.headline || profile.headline,
    phone: resume.basicInfo.phone || profile.phone,
    email: resume.basicInfo.email || profile.email,
    location: resume.basicInfo.location || profile.location,
    website: resume.basicInfo.website || profile.website,
    avatarUrl: resume.basicInfo.avatarUrl || profile.avatarUrl,
  };
}

export function contactParts(info: ResumeInfo): ContactParts {
  return { phone: info.phone, email: info.email, location: info.location, website: info.website };
}

export function contactLines(info: ResumeInfo): string[] {
  const parts = contactParts(info);
  return [parts.phone, parts.email, parts.location, parts.website].map((value) => value.trim()).filter(Boolean);
}

export function resumeStyle(template: ResumeTemplate, fontSize: number): CSSProperties {
  return {
    '--template-accent': template.accent,
    '--template-paper': template.paper,
    '--template-ink': template.ink,
    backgroundColor: template.paper,
    color: template.ink,
    fontSize,
  } as CSSProperties;
}

export function SectionTitle({ title, accent }: { title: string; accent: string }) {
  return (
    <h2
      className="font-display text-[1.05em] font-semibold"
      style={{ borderBottom: `1px solid ${accent}`, color: accent, margin: 0, paddingBottom: 4 }}
    >
      {title}
    </h2>
  );
}

export function WorkItemView({ item, accent }: { item: Resume['workExperiences'][number]; accent: string }) {
  return (
    <article>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{item.position}</h3>
          <p style={{ color: accent }}>{item.companyName}</p>
        </div>
        <p className="shrink-0 text-[0.85em] opacity-75">{formatDateRange(item.startDate, item.endDate)}</p>
      </div>
      <ul className="list-disc space-y-1 pl-5 leading-6" style={{ margin: '8px 0 0' }}>
        {[...item.responsibilities, ...item.achievements].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

export function ProjectItemView({ project }: { project: Resume['projects'][number] }) {
  return (
    <article>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{project.name}</h3>
          <p className="text-[0.9em] opacity-75">
            {project.role} · {project.techStack.join(' / ')}
          </p>
        </div>
        <p className="shrink-0 text-[0.85em] opacity-75">{formatDateRange(project.startDate, project.endDate)}</p>
      </div>
      <p className="leading-6" style={{ marginTop: 8 }}>
        {project.description}
      </p>
      {project.outcomes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 leading-6" style={{ margin: '8px 0 0' }}>
          {project.outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function SkillsView({ skills, accent }: { skills: Resume['skills']; accent: string }) {
  return (
    <div className="grid gap-2">
      {skills.map((skill) => (
        <div className="grid grid-cols-[1fr_auto] items-center gap-3" key={skill.id}>
          <div>
            <p className="font-semibold">{skill.name}</p>
            <p className="text-[0.82em] opacity-70">
              {skillCategoryLabels[skill.category]} · {skillLevelLabels[skill.level]}
            </p>
          </div>
          <div className="h-2 w-24 bg-black/10">
            <div className="h-full" style={{ width: `${skill.proficiency * 20}%`, backgroundColor: accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EducationView({ educations }: { educations: Resume['educations'] }) {
  return (
    <div className="space-y-3">
      {educations.map((education) => (
        <article className="flex items-start justify-between gap-4" key={education.id}>
          <div>
            <h3 className="font-semibold">{education.school}</h3>
            <p className="opacity-80">
              {education.major} · {educationLevelLabels[education.level]} · GPA {education.gpa}
            </p>
            {education.honors.length > 0 ? <p className="mt-1 text-[0.9em] opacity-75">{education.honors.join(' / ')}</p> : null}
          </div>
          <p className="shrink-0 text-[0.85em] opacity-75">{formatDateRange(education.startDate, education.endDate)}</p>
        </article>
      ))}
    </div>
  );
}

/** 经典版式首页完整页眉 */
export function FullHeader({ info, template }: { info: ResumeInfo; template: ResumeTemplate }) {
  return (
    <header
      className={template.layout === 'editorial' ? 'border-b pb-5' : undefined}
      style={{
        borderColor: template.accent,
        marginBottom: template.layout === 'editorial' ? 32 : 28,
      }}
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">{info.fullName}</h1>
          <p className="mt-2 text-lg" style={{ color: template.accent }}>
            {info.headline}
          </p>
        </div>
        {info.avatarUrl ? <img className="h-20 w-20 object-cover" src={info.avatarUrl} alt={info.fullName} /> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.9em] opacity-75">
        {contactLines(info).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </header>
  );
}

/** 侧栏版式首页完整左栏 */
export function FullSidebar({
  info,
  template,
  children,
}: {
  info: ResumeInfo;
  template: ResumeTemplate;
  children?: ReactNode;
}) {
  return (
    <aside className="border-r pr-5" style={{ borderColor: template.accent }}>
      {info.avatarUrl ? <img className="mb-4 h-24 w-24 object-cover" src={info.avatarUrl} alt={info.fullName} /> : null}
      <h1 className="font-display text-3xl font-semibold leading-tight">{info.fullName}</h1>
      <p className="mt-2 leading-6" style={{ color: template.accent }}>
        {info.headline}
      </p>
      <div className="space-y-2 text-[0.9em] leading-5 opacity-80" style={{ marginTop: 24 }}>
        {contactLines(info).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {children}
    </aside>
  );
}

/** 侧栏版式续页用的精简左栏：仅保留姓名与联系方式 */
export function CompactSidebar({ info, template }: { info: ResumeInfo; template: ResumeTemplate }) {
  return (
    <aside className="border-r pr-5" style={{ borderColor: template.accent }}>
      <h2 className="font-display text-lg font-semibold leading-tight">{info.fullName}</h2>
      <div className="space-y-2 text-[0.85em] leading-5 opacity-80" style={{ marginTop: 16 }}>
        {contactLines(info).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </aside>
  );
}

/** 经典版式续页用的精简页眉：仅保留姓名与联系方式 */
export function CompactHeader({ info, accent }: { info: ResumeInfo; accent: string }) {
  return (
    <header
      className="flex items-start justify-between gap-4 border-b"
      style={{ borderColor: accent, marginBottom: 16, paddingBottom: 8 }}
    >
      <h2 className="font-display text-lg font-semibold leading-tight">{info.fullName}</h2>
      <p className="max-w-[70%] text-right text-[0.8em] leading-5 opacity-75">{contactLines(info).join('  ·  ')}</p>
    </header>
  );
}

export function PageNumber({ index, total, color }: { index: number; total: number; color: string }) {
  // 页码从第二页开始显示；首页不渲染文字，但仍由外层预留等高空间以统一每页容量
  if (index <= 1) {
    return null;
  }
  return (
    <p
      aria-hidden
      className="text-center text-[0.72em]"
      style={{ color, marginTop: 24, opacity: 0.65 }}
    >
      {index} / {total}
    </p>
  );
}

/**
 * 将简历拆成线性的不可分页原子块。
 * 模块标题标记 attachNext，分页时必须和后面的第一个内容块一起换页，
 * 从而保证标题不会单独落在页尾、工作/项目条目不会被拆开。
 */
export function buildResumeBlocks(resume: Resume, profile: Profile = useProfileStore.getState().profile): AnyResumeBlock[] {
  const blocks: AnyResumeBlock[] = [];
  const enabledSections = resume.sections.filter((section) => section.enabled);

  for (const section of enabledSections) {
    if (section.id === 'summary') {
      const text = resume.summary || profile.summary;
      if (text.trim()) {
        blocks.push({ id: 'summary-text', type: 'summary', text, attachNext: false });
      }
      continue;
    }

    if (section.id === 'work') {
      if (resume.workExperiences.length === 0) {
        continue;
      }
      blocks.push({ id: 'work-title', type: 'section-title', title: section.title, attachNext: true });
      resume.workExperiences.forEach((item) => {
        blocks.push({ id: item.id, type: 'work-item', data: item, attachNext: false });
      });
      continue;
    }

    if (section.id === 'projects') {
      if (resume.projects.length === 0) {
        continue;
      }
      blocks.push({ id: 'projects-title', type: 'section-title', title: section.title, attachNext: true });
      resume.projects.forEach((project) => {
        blocks.push({ id: project.id, type: 'project-item', data: project, attachNext: false });
      });
      continue;
    }

    if (section.id === 'skills') {
      if (resume.skills.length === 0) {
        continue;
      }
      blocks.push({ id: 'skills-title', type: 'section-title', title: section.title, attachNext: true });
      blocks.push({ id: 'skills-list', type: 'skills', data: resume.skills, attachNext: false });
      continue;
    }

    if (section.id === 'education') {
      if (resume.educations.length === 0) {
        continue;
      }
      blocks.push({ id: 'education-title', type: 'section-title', title: section.title, attachNext: true });
      blocks.push({ id: 'education-list', type: 'education', data: resume.educations, attachNext: false });
    }
  }

  return blocks;
}

/** 原子块内容（不含块间距），供分页测量和实际渲染共用，保证两者一致 */
export function renderBlockContent(block: AnyResumeBlock, template: ResumeTemplate): ReactNode {
  switch (block.type) {
    case 'summary':
      return (
        <p className="leading-7" style={{ margin: 0 }}>
          {block.text}
        </p>
      );
    case 'section-title':
      return <SectionTitle title={block.title} accent={template.accent} />;
    case 'work-item':
      return <WorkItemView item={block.data} accent={template.accent} />;
    case 'project-item':
      return <ProjectItemView project={block.data} />;
    case 'skills':
      return <SkillsView skills={block.data} accent={template.accent} />;
    case 'education':
      return <EducationView educations={block.data} />;
  }
}

/** 同模块相邻条目间距 16px，模块标题与首个内容间距 12px，模块之间间距 20px，首个块无前置间距 */
export function gapBeforeBlock(blocks: AnyResumeBlock[], index: number): number {
  if (index <= 0) {
    return 0;
  }
  const current = blocks[index];
  const previous = blocks[index - 1];
  if (previous.type === 'section-title') {
    return 12;
  }
  if (
    (current.type === 'work-item' && previous.type === 'work-item') ||
    (current.type === 'project-item' && previous.type === 'project-item')
  ) {
    return 16;
  }
  return 20;
}

export function getResumeTemplate(resume: Resume): ResumeTemplate {
  return getTemplateById(resume.templateId);
}
