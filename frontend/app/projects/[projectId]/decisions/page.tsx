'use client';

import { useParams } from 'next/navigation';
import DecisionScreen from './DecisionScreen';

export default function DecisionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <DecisionScreen key={projectId} projectId={projectId} />;
}
