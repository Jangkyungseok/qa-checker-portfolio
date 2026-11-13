'use client';
import { useParams } from 'next/navigation';
import IssueReportScreen from './IssueReportScreen';

export default function Page() {
  const { projectId } = useParams<{ projectId: string }>();
  return <IssueReportScreen key={projectId} projectId={projectId} />;
}
