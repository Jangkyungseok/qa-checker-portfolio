import { STATES } from '../defects/issue-model';

export type ReportIssue = {
  id: string; project_id: string; issue_code: string; title: string;
  status: keyof typeof STATES; priority: string; reproducibility: string;
  build_version: string | null; device_os: string; updated_at: string;
};
export type IssueReport = {
  schemaVersion: number;
  project: { id: string; name: string };
  generatedAt: string;
  filters: { period: string; buildVersion: string | null; dateBasis: string; timezone: string; from: string | null; to: string };
  buildVersions: string[];
  totals: { total: number; pending: number; inProgress: number; responded: number; verified: number; skip: number };
  completion: { completed: number; total: number; rate: number };
  byStatus: Record<keyof typeof STATES, number>;
  byPriority: Record<string, number>;
  byFrequency: Record<string, number>;
  rerequest: { current: number; affectedIssues: number; totalTransitions: number };
  skip: { requested: number; confirmed: number; rate: number };
  trend: { date: string; created: number; verified: number }[];
  remainingIssues: ReportIssue[];
  rerequestIssues: ReportIssue[];
  pagination: { pageSize: number; remaining: { page: number; total: number }; rerequest: { page: number; total: number } };
};
