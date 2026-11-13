import { DefectReportDto } from './dto/defect-report.dto';

// Shared creation-date cohort. now() is fixed throughout an export transaction.
export const REPORT_COHORT = `d.project_id=$1 AND d.created_at<=now()
  AND ($2::int IS NULL OR d.created_at>=
    (((now() AT TIME ZONE 'Asia/Seoul')::date - ($2::int-1))::timestamp AT TIME ZONE 'Asia/Seoul'))
  AND ($3::text IS NULL OR d.build_version=$3)`;
export const reportParams = (dto: DefectReportDto) => [dto.projectId, dto.period === 'ALL' ? null : Number(dto.period), dto.buildVersion ?? null];
export type ReportDates = { startDate: string; endDate: string };
export const datedCohort = (start: number, end: number) => `${REPORT_COHORT}
  AND d.created_at>=($${start}::date::timestamp AT TIME ZONE 'Asia/Seoul')
  AND d.created_at<(($${end}::date+1)::timestamp AT TIME ZONE 'Asia/Seoul')`;
