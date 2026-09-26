import { useProfileStore } from '../../stores/profile';
import { getTemplateById, ResumeTemplate } from '../../stores/template';
import { Resume } from '../../types/resume';
import {
  EducationItemBlock,
  ProjectItemBlock,
  ResumeHeaderFull,
  ResumeSidebar,
  resolveResumeInfo,
  resumeContentStyle,
  SectionTitle,
  SkillItemBlock,
  SummaryBlock,
  WorkItemBlock,
} from './blocks';

interface ResumePreviewProps {
  resume: Resume;
  template?: ResumeTemplate;
  fontSize?: number;
}

export function ResumePreview({ resume, template = getTemplateById(resume.templateId), fontSize = 14 }: ResumePreviewProps) {
  const profile = useProfileStore((state) => state.profile);
  const info = resolveResumeInfo(resume, profile);
  const enabledSections = resume.sections.filter((section) => section.enabled);

  const content = (
    <div className="space-y-5">
      {enabledSections.map((section) => {
        if (section.id === 'summary') {
          return (
            <section key={section.id}>
              <SectionTitle className="mb-3" accent={template.accent} title={section.title} />
              <SummaryBlock text={resume.summary || profile.summary} />
            </section>
          );
        }

        if (section.id === 'work') {
          return (
            <section key={section.id}>
              <SectionTitle className="mb-3" accent={template.accent} title={section.title} />
              <div className="space-y-4">
                {resume.workExperiences.map((item) => (
                  <WorkItemBlock accent={template.accent} item={item} key={item.id} />
                ))}
              </div>
            </section>
          );
        }

        if (section.id === 'projects') {
          return (
            <section key={section.id}>
              <SectionTitle className="mb-3" accent={template.accent} title={section.title} />
              <div className="space-y-4">
                {resume.projects.map((project) => (
                  <ProjectItemBlock accent={template.accent} item={project} key={project.id} />
                ))}
              </div>
            </section>
          );
        }

        if (section.id === 'skills') {
          return (
            <section key={section.id}>
              <SectionTitle className="mb-3" accent={template.accent} title={section.title} />
              <div className="grid gap-2">
                {resume.skills.map((skill) => (
                  <SkillItemBlock accent={template.accent} item={skill} key={skill.id} />
                ))}
              </div>
            </section>
          );
        }

        return (
          <section key={section.id}>
            <SectionTitle className="mb-3" accent={template.accent} title={section.title} />
            <div className="space-y-3">
              {resume.educations.map((education) => (
                <EducationItemBlock item={education} key={education.id} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  if (template.layout === 'sidebar') {
    return (
      <article className="min-h-full p-8 shadow-sm" style={resumeContentStyle(template, fontSize)}>
        <div className="grid grid-cols-[190px_1fr] gap-8">
          <ResumeSidebar info={info} template={template} />
          <main>{content}</main>
        </div>
      </article>
    );
  }

  return (
    <article className="min-h-full p-8 shadow-sm" style={resumeContentStyle(template, fontSize)}>
      <ResumeHeaderFull
        className={template.layout === 'editorial' ? 'mb-8' : 'mb-7'}
        info={info}
        template={template}
      />
      {content}
    </article>
  );
}

