import { forwardRef } from 'react';
import { Resume } from '../../types/resume';
import { PaginatedResume } from './PaginatedResume';

interface A4PreviewProps {
  resume: Resume;
  margin: number;
  fontSize: number;
}

export const A4Preview = forwardRef<HTMLDivElement, A4PreviewProps>(({ resume, margin, fontSize }, ref) => (
  <PaginatedResume ref={ref} fontSize={fontSize} margin={margin} resume={resume} />
));

A4Preview.displayName = 'A4Preview';

