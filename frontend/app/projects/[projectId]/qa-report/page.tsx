'use client';
import { useParams } from 'next/navigation';
import LeaveGuard from '../decisions/LeaveGuard';
import QaReportScreen from './QaReportScreen';
export default function Page(){const {projectId}=useParams<{projectId:string}>();return <LeaveGuard><QaReportScreen projectId={projectId}/></LeaveGuard>;}
