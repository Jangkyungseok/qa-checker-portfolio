'use client';
import { useParams } from 'next/navigation';
import LeaveGuard from '../../decisions/LeaveGuard';
import QaReportScreen from '../QaReportScreen';
export default function Page(){const {projectId,reportId}=useParams<{projectId:string;reportId:string}>();return <LeaveGuard><QaReportScreen key={reportId} projectId={projectId} reportId={reportId}/></LeaveGuard>;}
