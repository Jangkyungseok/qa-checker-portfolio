'use client';

import { useParams } from 'next/navigation';
import DecisionScreen from '../DecisionScreen';

export default function DecisionDetailPage() {
  const { projectId, decisionId } = useParams<{ projectId: string; decisionId: string }>();
  return <DecisionScreen key={`${projectId}:${decisionId}`} projectId={projectId} decisionId={decisionId} />;
}
