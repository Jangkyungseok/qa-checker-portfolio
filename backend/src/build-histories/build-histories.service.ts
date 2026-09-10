import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { CreateBuildHistoryDto } from './dto/create-build-history.dto';
import { UpdateBuildHistoryDto } from './dto/update-build-history.dto';

const HISTORY_SELECT = `
  SELECT
    bh.id,
    bh.project_id,
    p.name AS project_name,
    bh.version,
    to_char(bh.delivered_at, 'YYYY-MM-DD') AS delivered_at,
    bh.change_summary,
    bh.qa_notes,
    bh.source_type,
    bh.source_branch,
    bh.risk_level,
    bh.regression_required,
    bh.additional_test_required,
    bh.review_status,
    bh.reviewed_by,
    reviewer.name AS reviewed_by_name,
    bh.reviewed_at,
    bh.created_by,
    creator.name AS created_by_name,
    bh.updated_by,
    updater.name AS updated_by_name,
    bh.created_at,
    bh.updated_at,
    ARRAY(
      SELECT bhi.inspection_id
      FROM build_history_inspections bhi
      WHERE bhi.build_history_id = bh.id
      ORDER BY bhi.linked_at ASC, bhi.inspection_id ASC
    ) AS inspection_ids,
    ARRAY(
      SELECT bhi.impact_area
      FROM build_history_impacts bhi
      WHERE bhi.build_history_id = bh.id
      ORDER BY bhi.impact_area ASC
    ) AS impact_areas
  FROM build_histories bh
  JOIN projects p ON p.id = bh.project_id
  JOIN users creator ON creator.id = bh.created_by
  JOIN users updater ON updater.id = bh.updated_by
  LEFT JOIN users reviewer ON reviewer.id = bh.reviewed_by
`;

@Injectable()
export class BuildHistoriesService {
  constructor(private readonly db: DbService) {}

  async list(projectId?: string) {
    const result = await this.db.query(
      `${HISTORY_SELECT}
       WHERE ($1::uuid IS NULL OR bh.project_id = $1)
       ORDER BY bh.delivered_at DESC, bh.created_at DESC`,
      [projectId ?? null],
    );
    return result.rows;
  }

  async get(historyId: string) {
    const result = await this.db.query(
      `${HISTORY_SELECT}
       WHERE bh.id = $1
       LIMIT 1`,
      [historyId],
    );
    if (!result.rowCount) {
      throw new NotFoundException('빌드 히스토리를 찾을 수 없습니다.');
    }
    return result.rows[0];
  }

  async create(dto: CreateBuildHistoryDto, userId: string) {
    const historyId = await this.db.transaction(async (client) => {
      const projectResult = await client.query(
        `SELECT id, is_active FROM projects WHERE id = $1 LIMIT 1`,
        [dto.projectId],
      );
      const project = projectResult.rows[0];
      if (!project || !project.is_active) {
        throw new NotFoundException('활성 프로젝트를 찾을 수 없습니다.');
      }

      const inspectionIds = dto.inspectionIds ?? [];
      await this.validateInspections(client, inspectionIds, dto.projectId);

      const result = await client.query(
        `
        INSERT INTO build_histories (
          project_id, version, delivered_at, change_summary, qa_notes,
          source_type, source_branch, risk_level, regression_required,
          additional_test_required, created_by, updated_by
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        RETURNING id
        `,
        [
          dto.projectId,
          dto.version.trim(),
          dto.deliveredAt,
          dto.changeSummary.trim(),
          dto.qaNotes?.trim() || null,
          dto.sourceType ?? 'MANUAL',
          dto.sourceBranch?.trim() || null,
          dto.riskLevel ?? null,
          dto.regressionRequired ?? null,
          dto.additionalTestRequired ?? null,
          userId,
        ],
      );

      const id = result.rows[0].id as string;
      await this.syncInspections(client, id, inspectionIds, userId);
      await this.syncImpacts(client, id, dto.impactAreas ?? []);
      return id;
    });

    return this.get(historyId);
  }

  async update(historyId: string, dto: UpdateBuildHistoryDto, userId: string) {
    await this.db.transaction(async (client) => {
      const existingResult = await client.query(
        `
        SELECT id, project_id, version,
          to_char(delivered_at, 'YYYY-MM-DD') AS delivered_at,
          change_summary, qa_notes, source_type, source_branch, risk_level,
          regression_required, additional_test_required
        FROM build_histories
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [historyId],
      );
      const existing = existingResult.rows[0];
      if (!existing) {
        throw new NotFoundException('빌드 히스토리를 찾을 수 없습니다.');
      }

      if (dto.inspectionIds !== undefined) {
        await this.validateInspections(client, dto.inspectionIds, existing.project_id);
      }

      await client.query(
        `
        UPDATE build_histories
        SET version = $2, delivered_at = $3::date, change_summary = $4,
          qa_notes = $5, source_type = $6, source_branch = $7,
          risk_level = $8, regression_required = $9,
          additional_test_required = $10, updated_by = $11, updated_at = now()
        WHERE id = $1
        `,
        [
          historyId,
          dto.version?.trim() ?? existing.version,
          dto.deliveredAt ?? existing.delivered_at,
          dto.changeSummary?.trim() ?? existing.change_summary,
          dto.qaNotes === undefined ? existing.qa_notes : dto.qaNotes.trim() || null,
          dto.sourceType ?? existing.source_type,
          dto.sourceBranch === undefined
            ? existing.source_branch
            : dto.sourceBranch?.trim() || null,
          dto.riskLevel === undefined ? existing.risk_level : dto.riskLevel,
          dto.regressionRequired === undefined
            ? existing.regression_required
            : dto.regressionRequired,
          dto.additionalTestRequired === undefined
            ? existing.additional_test_required
            : dto.additionalTestRequired,
          userId,
        ],
      );

      if (dto.inspectionIds !== undefined) {
        await this.syncInspections(client, historyId, dto.inspectionIds, userId);
      }
      if (dto.impactAreas !== undefined) {
        await this.syncImpacts(client, historyId, dto.impactAreas);
      }
    });

    return this.get(historyId);
  }

  async review(historyId: string, reviewed: boolean, userId: string) {
    const result = await this.db.query(
      `
      UPDATE build_histories
      SET review_status = $2,
        reviewed_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END,
        reviewed_at = CASE WHEN $3 THEN now() ELSE NULL END,
        updated_by = $4,
        updated_at = now()
      WHERE id = $1
      RETURNING id
      `,
      [historyId, reviewed ? 'REVIEWED' : 'DRAFT', reviewed, userId],
    );
    if (!result.rowCount) {
      throw new NotFoundException('빌드 히스토리를 찾을 수 없습니다.');
    }
    return this.get(historyId);
  }

  private async validateInspections(
    client: PoolClient,
    inspectionIds: string[],
    projectId: string,
  ) {
    if (new Set(inspectionIds).size !== inspectionIds.length) {
      throw new BadRequestException('중복된 검사 ID는 연결할 수 없습니다.');
    }
    if (inspectionIds.length === 0) return;

    const result = await client.query(
      `SELECT id, project_id FROM inspections WHERE id = ANY($1::uuid[])`,
      [inspectionIds],
    );
    if (result.rows.length !== inspectionIds.length) {
      throw new BadRequestException('존재하지 않는 검사가 포함되어 있습니다.');
    }
    if (result.rows.some((inspection) => inspection.project_id !== projectId)) {
      throw new BadRequestException(
        '같은 프로젝트의 검사만 빌드 히스토리에 연결할 수 있습니다.',
      );
    }
  }

  private async syncInspections(
    client: PoolClient,
    historyId: string,
    inspectionIds: string[],
    userId: string,
  ) {
    await client.query(
      `DELETE FROM build_history_inspections WHERE build_history_id = $1`,
      [historyId],
    );
    if (inspectionIds.length === 0) return;

    await client.query(
      `
      INSERT INTO build_history_inspections (build_history_id, inspection_id, linked_by)
      SELECT $1, inspection_id, $3
      FROM unnest($2::uuid[]) AS linked_inspection(inspection_id)
      `,
      [historyId, inspectionIds, userId],
    );
  }

  private async syncImpacts(
    client: PoolClient,
    historyId: string,
    impactAreas: string[],
  ) {
    await client.query(
      `DELETE FROM build_history_impacts WHERE build_history_id = $1`,
      [historyId],
    );
    if (impactAreas.length === 0) return;

    await client.query(
      `
      INSERT INTO build_history_impacts (build_history_id, impact_area)
      SELECT $1, impact_area
      FROM unnest($2::varchar[]) AS linked_impact(impact_area)
      `,
      [historyId, impactAreas],
    );
  }
}
