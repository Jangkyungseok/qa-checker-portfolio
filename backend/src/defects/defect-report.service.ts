import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DefectReportDto } from './dto/defect-report.dto';

@Injectable()
export class DefectReportService {
  constructor(private readonly db: DbService) {}

  async get(dto: DefectReportDto) {
    // One statement gives every aggregate and page the same PostgreSQL snapshot.
    // Period selects a creation-date cohort, not historical status at the period end.
    const result = await this.db.query(`
      WITH clock AS (
        SELECT now() AS as_of, (now() AT TIME ZONE 'Asia/Seoul')::date AS today
      ), bounds AS (
        SELECT *, CASE WHEN $2::int IS NULL THEN NULL
          ELSE (today - ($2::int - 1))::timestamp AT TIME ZONE 'Asia/Seoul' END AS starts_at,
          today - (coalesce($2::int, 7) - 1) AS trend_start FROM clock
      ), cohort AS MATERIALIZED (
        SELECT d.* FROM defects d CROSS JOIN bounds b
        WHERE d.project_id=$1 AND d.created_at<=b.as_of
          AND (b.starts_at IS NULL OR d.created_at>=b.starts_at)
          AND ($3::text IS NULL OR d.build_version=$3)
      ), events AS MATERIALIZED (
        SELECT a.* FROM defect_activities a JOIN cohort d ON d.id=a.defect_id
        CROSS JOIN bounds b WHERE a.event_type='STATUS_CHANGED' AND a.created_at<=b.as_of
      ), counts AS (
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE status IN ('NEW','REQUESTED','RE_REQUESTED'))::int AS pending,
          count(*) FILTER (WHERE status='IN_PROGRESS')::int AS in_progress,
          count(*) FILTER (WHERE status='RESPONDED')::int AS responded,
          count(*) FILTER (WHERE status='VERIFIED')::int AS verified,
          count(*) FILTER (WHERE status='SKIP_REQUESTED')::int AS skip_requested,
          count(*) FILTER (WHERE status='SKIP_CONFIRMED')::int AS skip_confirmed,
          count(*) FILTER (WHERE status='RE_REQUESTED')::int AS rerequested,
          count(*) FILTER (WHERE status NOT IN ('VERIFIED','SKIP_CONFIRMED'))::int AS remaining
        FROM cohort
      ), days AS (
        SELECT b.trend_start + n AS day FROM bounds b,
          generate_series(0, b.today - b.trend_start) AS n
      ), created_daily AS (
        SELECT (created_at AT TIME ZONE 'Asia/Seoul')::date AS day, count(*)::int AS n
        FROM cohort GROUP BY 1
      ), verified_daily AS (
        SELECT (created_at AT TIME ZONE 'Asia/Seoul')::date AS day,
          count(DISTINCT defect_id)::int AS n
        FROM events WHERE changes->>'to'='VERIFIED' GROUP BY 1
      ), rows AS (
        SELECT id, project_id, defect_no,
          'ISSUE-' || lpad(defect_no::text,greatest(6,length(defect_no::text)),'0') AS issue_code,
          title,status,priority,reproducibility,build_version,device_os,created_at,updated_at
        FROM cohort
      ), remaining_page AS (
        SELECT * FROM rows WHERE status NOT IN ('VERIFIED','SKIP_CONFIRMED')
        ORDER BY updated_at DESC,id LIMIT 20 OFFSET (($4::int-1)*20)
      ), rerequest_page AS (
        SELECT * FROM rows WHERE status='RE_REQUESTED'
        ORDER BY updated_at DESC,id LIMIT 20 OFFSET (($5::int-1)*20)
      )
      SELECT jsonb_build_object(
        'schemaVersion',1, 'project',jsonb_build_object('id',p.id,'name',p.name),
        'generatedAt',b.as_of,
        'filters',jsonb_build_object('period',$6::text,'buildVersion',$3::text,
          'dateBasis','CREATED_AT','timezone','Asia/Seoul','from',b.starts_at,'to',b.as_of),
        'buildVersions',coalesce((SELECT jsonb_agg(v.build_version ORDER BY v.build_version)
          FROM (SELECT DISTINCT build_version FROM defects WHERE project_id=$1
            AND build_version IS NOT NULL AND btrim(build_version)<>'') v),'[]'::jsonb),
        'totals',jsonb_build_object('total',c.total,'pending',c.pending,'inProgress',c.in_progress,
          'responded',c.responded,'verified',c.verified,'skip',c.skip_requested+c.skip_confirmed),
        'completion',jsonb_build_object('completed',c.verified+c.skip_confirmed,'total',c.total,
          'rate',coalesce(round(100.0*(c.verified+c.skip_confirmed)/nullif(c.total,0),1),0)),
        'byStatus',(SELECT jsonb_object_agg(s.status,(SELECT count(*)::int FROM cohort d WHERE d.status=s.status))
          FROM unnest(ARRAY['NEW','REQUESTED','RE_REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED']) s(status)),
        'byPriority','{"IMMEDIATE":0,"HIGH":0,"NORMAL":0,"LOW":0}'::jsonb || coalesce((SELECT jsonb_object_agg(priority,n) FROM
          (SELECT priority,count(*)::int n FROM cohort GROUP BY priority) q),'{}'::jsonb),
        'byFrequency','{"PERCENT_100":0,"PERCENT_70":0,"PERCENT_50":0,"PERCENT_30":0,"PERCENT_1":0}'::jsonb || coalesce((SELECT jsonb_object_agg(reproducibility,n) FROM
          (SELECT reproducibility,count(*)::int n FROM cohort GROUP BY reproducibility) q),'{}'::jsonb),
        'rerequest',jsonb_build_object('current',c.rerequested,
          'affectedIssues',(SELECT count(DISTINCT defect_id)::int FROM events WHERE changes->>'to'='RE_REQUESTED'),
          'totalTransitions',(SELECT count(*)::int FROM events WHERE changes->>'to'='RE_REQUESTED')),
        'skip',jsonb_build_object('requested',c.skip_requested,'confirmed',c.skip_confirmed,
          'rate',coalesce(round(100.0*c.skip_confirmed/nullif(c.total,0),1),0)),
        'trend', (SELECT jsonb_agg(jsonb_build_object('date',to_char(d.day,'YYYY-MM-DD'),
          'created',coalesce(n.n,0),'verified',coalesce(v.n,0)) ORDER BY d.day)
          FROM days d LEFT JOIN created_daily n USING(day) LEFT JOIN verified_daily v USING(day)),
        'remainingIssues',coalesce((SELECT jsonb_agg(r ORDER BY updated_at DESC,id) FROM remaining_page r),'[]'::jsonb),
        'rerequestIssues',coalesce((SELECT jsonb_agg(r ORDER BY updated_at DESC,id) FROM rerequest_page r),'[]'::jsonb),
        'pagination',jsonb_build_object('pageSize',20,
          'remaining',jsonb_build_object('page',$4::int,'total',c.remaining),
          'rerequest',jsonb_build_object('page',$5::int,'total',c.rerequested))
      ) AS report FROM projects p CROSS JOIN bounds b CROSS JOIN counts c WHERE p.id=$1
    `, [dto.projectId, dto.period==='ALL'?null:Number(dto.period), dto.buildVersion??null,
      dto.remainingPage,dto.rerequestPage,dto.period]);
    if (!result.rowCount) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    return result.rows[0].report;
  }
}
