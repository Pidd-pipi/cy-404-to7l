import { CSSProperties } from 'react';
import { ResumeTemplate } from '../../stores/template';
import { educationLevelLabels, skillCategoryLabels, skillLevelLabels } from '../../types/enums';
import { Education } from '../../types/education';
import { Profile } from '../../types/profile';
import { Project } from '../../types/project';
import { Resume } from '../../types/resume';
import { Skill } from '../../types/skill';
import { WorkExperience } from '../../types/work-experience';
import { formatDateRange } from '../../utils/format';

/** Personal info shown in the header, with the global profile as fallback. */
export interface ResumeInfo {
  fullName: string;
  headline: string;
  phone: string;
  email: string;
  location: string;
  website: string;
  avatarUrl?: string;
}

export function resolveResumeInfo(resume: Resume, profile: Profile): ResumeInfo {
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

export function contactLine(info: ResumeInfo): string {
  return [info.phone, info.email, info.location, info.website].filter(Boolean).join(' · ');
}

/** Style context consumed by every block: template colors + base font size. */
export function resumeContentStyle(template: ResumeTemplate, fontSize: number): CSSProperties {
  return {
    '--template-accent': template.accent,
    '--template-paper': template.paper,
    '--template-ink': template.ink,
    backgroundColor: template.paper,
    color: template.ink,
    fontSize,
  } as CSSProperties;
}

export function SectionTitle({ title, accent, className = '' }: { title: string; accent: string; className?: string }) {
  return (
    <h2
      className={`border-b pb-1 font-display text-[1.05em] font-semibold ${className}`.trim()}
      style={{ borderColor: accent, color: accent }}
    >
      {title}
    </h2>
  );
}

export function SummaryBlock({ text }: { text: string }) {
  return <p className="leading-7">{text}</p>;
}

export function WorkItemBlock({ item, accent }: { item: WorkExperience; accent: string }) {
  return (
    <article>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{item.position}</h3>
          <p style={{ color: accent }}>{item.companyName}</p>
        </div>
        <p className="shrink-0 text-[0.85em] opacity-75">{formatDateRange(item.startDate, item.endDate)}</p>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
        {[...item.responsibilities, ...item.achievements].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

export function ProjectItemBlock({ item, accent }: { item: Project; accent: string }) {
  return (
    <article>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{item.name}</h3>
          <p className="text-[0.9em] opacity-75">
            {item.role} · {item.techStack.join(' / ')}
          </p>
        </div>
        <p className="shrink-0 text-[0.85em] opacity-75">{formatDateRange(item.startDate, item.endDate)}</p>
      </div>
      <p className="mt-2 leading-6">{item.description}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
        {item.outcomes.map((outcome) => (
          <li key={outcome}>{outcome}</li>
        ))}
      </ul>
    </article>
  );
}

export function SkillItemBlock({ item, accent }: { item: Skill; accent: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div>
        <p className="font-semibold">{item.name}</p>
        <p className="text-[0.82em] opacity-70">
          {skillCategoryLabels[item.category]} · {skillLevelLabels[item.level]}
        </p>
      </div>
      <div className="h-2 w-24 bg-black/10">
        <div className="h-full" style={{ width: `${item.proficiency * 20}%`, backgroundColor: accent }} />
      </div>
    </div>
  );
}

export function EducationItemBlock({ item }: { item: Education }) {
  return (
    <article className="flex items-start justify-between gap-4">
      <div>
        <h3 className="font-semibold">{item.school}</h3>
        <p className="opacity-80">
          {item.major} · {educationLevelLabels[item.level]} · GPA {item.gpa}
        </p>
        {item.honors.length > 0 ? <p className="mt-1 text-[0.9em] opacity-75">{item.honors.join(' / ')}</p> : null}
      </div>
      <p className="shrink-0 text-[0.85em] opacity-75">{formatDateRange(item.startDate, item.endDate)}</p>
    </article>
  );
}

/** Full header used on the first page: name, headline, avatar and contacts. */
export function ResumeHeaderFull({ info, template, className = '' }: { info: ResumeInfo; template: ResumeTemplate; className?: string }) {
  return (
    <header
      className={`${template.layout === 'editorial' ? 'border-b pb-5' : ''} ${className}`.trim()}
      style={{ borderColor: template.accent }}
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
        <span>{info.phone}</span>
        <span>{info.email}</span>
        <span>{info.location}</span>
        <span>{info.website}</span>
      </div>
    </header>
  );
}

/** Compact header repeated from page 2 onwards so every page keeps name + contacts. */
export function ResumeHeaderCompact({ info, template, className = '' }: { info: ResumeInfo; template: ResumeTemplate; className?: string }) {
  return (
    <header className={`border-b pb-3 ${className}`.trim()} style={{ borderColor: template.accent }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="font-display text-xl font-semibold leading-tight">{info.fullName}</h1>
        <p className="text-[0.85em] opacity-75">{contactLine(info)}</p>
      </div>
    </header>
  );
}

/** Sidebar column with name and contacts, repeated on every page of sidebar layouts. */
export function ResumeSidebar({ info, template }: { info: ResumeInfo; template: ResumeTemplate }) {
  return (
    <aside className="border-r pr-5" style={{ borderColor: template.accent }}>
      {info.avatarUrl ? <img className="mb-4 h-24 w-24 object-cover" src={info.avatarUrl} alt={info.fullName} /> : null}
      <h1 className="font-display text-3xl font-semibold leading-tight">{info.fullName}</h1>
      <p className="mt-2 leading-6" style={{ color: template.accent }}>
        {info.headline}
      </p>
      <div className="mt-6 space-y-2 text-[0.9em] leading-5 opacity-80">
        <p>{info.phone}</p>
        <p>{info.email}</p>
        <p>{info.location}</p>
        <p>{info.website}</p>
      </div>
    </aside>
  );
}

/** Page number, rendered from page 2 onwards. */
export function PageFooter({ page, total, className = '' }: { page: number; total: number; className?: string }) {
  return (
    <footer className={`text-center text-[0.8em] opacity-60 ${className}`.trim()}>
      第 {page} 页 / 共 {total} 页
    </footer>
  );
}

