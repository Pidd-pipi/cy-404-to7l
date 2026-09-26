import { CSSProperties, useMemo } from 'react';
import { useProfileStore } from '../../stores/profile';
import { ResumeTemplate } from '../../stores/template';
import { Resume } from '../../types/resume';
import {
  AnyResumeBlock,
  FullHeader,
  FullSidebar,
  gapBeforeBlock,
  getResumeTemplate,
  renderBlockContent,
  resolveResumeInfo,
  resumeStyle,
  buildResumeBlocks,
} from './resumeBlocks';

interface ResumePreviewProps {
  resume: Resume;
  template?: ResumeTemplate;
  fontSize?: number;
}

function ContinuousBlocks({ blocks, template }: { blocks: AnyResumeBlock[]; template: ResumeTemplate }) {
  return (
    <div>
      {blocks.map((block, index) => (
        <div key={block.id} style={{ marginTop: gapBeforeBlock(blocks, index) }}>
          {renderBlockContent(block, template)}
        </div>
      ))}
    </div>
  );
}

export function ResumePreview({ resume, template = getResumeTemplate(resume), fontSize = 14 }: ResumePreviewProps) {
  const profile = useProfileStore((state) => state.profile);
  const info = useMemo(() => resolveResumeInfo(resume, profile), [resume, profile]);
  const blocks = useMemo(() => buildResumeBlocks(resume, profile), [resume, profile]);
  const style = resumeStyle(template, fontSize) as CSSProperties;

  if (template.layout === 'sidebar') {
    return (
      <article className="min-h-full p-8 shadow-sm" style={style}>
        <div className="grid grid-cols-[190px_1fr] gap-8">
          <FullSidebar info={info} template={template} />
          <main>
            <ContinuousBlocks blocks={blocks} template={template} />
          </main>
        </div>
      </article>
    );
  }

  return (
    <article className="min-h-full p-8 shadow-sm" style={style}>
      <FullHeader info={info} template={template} />
      <ContinuousBlocks blocks={blocks} template={template} />
    </article>
  );
}
