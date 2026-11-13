'use client';
import { useParams } from 'next/navigation';
import DefectScreen from '../DefectScreen';
export default function Page() {
  const { projectId } = useParams<{ projectId: string }>();
  return <DefectScreen key={projectId} projectId={projectId} create />;
}
