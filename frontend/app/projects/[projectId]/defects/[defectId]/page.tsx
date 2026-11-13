'use client';
import { useParams } from 'next/navigation';
import DefectScreen from '../DefectScreen';
export default function Page() {
  const { projectId, defectId } = useParams<{ projectId: string; defectId: string }>();
  return <DefectScreen key={defectId} projectId={projectId} defectId={defectId} />;
}
