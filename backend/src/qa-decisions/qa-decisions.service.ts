import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { CreateQaDecisionDto } from './dto/create-qa-decision.dto';
import { ListQaDecisionsDto } from './dto/list-qa-decisions.dto';
import { ResolveQaDecisionDto } from './dto/resolve-qa-decision.dto';
import { UpdateQaDecisionDto } from './dto/update-qa-decision.dto';

const QA_DECISION_SELECT = `
  SELECT
    qdm.id,
    qdm.project_id,
    project.name AS project_name,
    qdm.build_history_id,
    build_history.version AS build_history_version,
    qdm.build_version_snapshot,
    qdm.inspection_id,
    inspection.version AS inspection_version,
    qdm.inspection_version_snapshot,
    qdm.decision_type,
    qdm.risk_level,
    qdm.decision,
    qdm.reason,
    qdm.conditions,
    qdm.related_url,
    qdm.result,
    qdm.status,
    qdm.created_by,
    creator.name AS created_by_name,
    qdm.updated_by,
    updater.name AS updated_by_name,
    qdm.resolved_by,
    resolver.name AS resolved_by_name,
    qdm.created_at,
    qdm.updated_at,
    qdm.resolved_at
  FROM qa_decision_memories qdm
  JOIN projects project ON project.id = qdm.project_id
  LEFT JOIN build_histories build_history ON build_history.id = qdm.build_history_id
  LEFT JOIN inspections inspection ON inspection.id = qdm.inspection_id
  JOIN users creator ON creator.id = qdm.created_by
  JOIN users updater ON updater.id = qdm.updated_by
  LEFT JOIN users resolver ON resolver.id = qdm.resolved_by
`;

type LinkedRecord = {
  id: string;
  project_id: string;
  version: string;
};

@Injectable()
export class QaDecisionsService {
  constructor(private readonly db: DbService) {}

  async list(filters: ListQaDecisionsDto) {
    const result = await this.db.query(
      `${QA_DECISION_SELECT}
       WHERE ($1::uuid IS NULL OR qdm.project_id = $1)
         AND ($2::varchar IS NULL OR qdm.status = $2)
         AND ($3::varchar IS NULL OR qdm.risk_level = $3)
         AND ($4::varchar IS NULL OR qdm.decision_type = $4)
       ORDER BY qdm.created_at DESC`,
      [
        filters.projectId ?? null,
        filters.status ?? null,
        filters.riskLevel ?? null,
        filters.decisionType ?? null,
      ],
    );
    return result.rows;
  }

  async get(decisionId: string) {
    const result = await this.db.query(
      `${QA_DECISION_SELECT}
       WHERE qdm.id = $1
       LIMIT 1`,
      [decisionId],
    );
    if (!result.rowCount) {
      throw new NotFoundException('QA 판단 기록을 찾을 수 없습니다.');
    }
    return result.rows[0];
  }

  async create(dto: CreateQaDecisionDto, userId: string) {
    const decisionId = await this.db.transaction(async (client) => {
      await this.requireProject(client, dto.projectId);
      const buildHistory = dto.buildHistoryId
        ? await this.requireBuildHistory(client, dto.buildHistoryId, dto.projectId)
        : null;
      const inspection = dto.inspectionId
        ? await this.requireInspection(client, dto.inspectionId, dto.projectId)
        : null;
      const decision = dto.decision.trim();
      const reason = dto.reason.trim();
      if (!decision || !reason) {
        throw new BadRequestException('판단 내용과 판단 근거는 필수입니다.');
      }

      const result = await client.query(
        `
        INSERT INTO qa_decision_memories (
          project_id,
          build_history_id,
          build_version_snapshot,
          inspection_id,
          inspection_version_snapshot,
          decision_type,
          risk_level,
          decision,
          reason,
          conditions,
          related_url,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $12, $11, $11)
        RETURNING id
        `,
        [
          dto.projectId,
          buildHistory?.id ?? null,
          buildHistory?.version ?? null,
          inspection?.id ?? null,
          inspection?.version ?? null,
          dto.decisionType,
          dto.riskLevel ?? null,
          decision,
          reason,
          dto.conditions?.trim() || null,
          userId,
          dto.relatedUrl ?? null,
        ],
      );
      return result.rows[0].id as string;
    });

    return this.get(decisionId);
  }

  async update(decisionId: string, dto: UpdateQaDecisionDto, userId: string) {
    await this.db.transaction(async (client) => {
      const existingResult = await client.query(
        `
        SELECT *
        FROM qa_decision_memories
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [decisionId],
      );
      const existing = existingResult.rows[0];
      if (!existing) {
        throw new NotFoundException('QA 판단 기록을 찾을 수 없습니다.');
      }
      if (existing.status === 'RESOLVED') {
        throw new ConflictException('대응 완료된 이력은 수정할 수 없습니다. 먼저 처리 중으로 변경해 주세요.');
      }

      const buildHistory =
        dto.buildHistoryId === undefined
          ? undefined
          : dto.buildHistoryId === null
            ? null
            : await this.requireBuildHistory(
                client,
                dto.buildHistoryId,
                existing.project_id,
              );
      const inspection =
        dto.inspectionId === undefined
          ? undefined
          : dto.inspectionId === null
            ? null
            : await this.requireInspection(
                client,
                dto.inspectionId,
                existing.project_id,
              );

      const decision = dto.decision?.trim();
      const reason = dto.reason?.trim();
      if (dto.decision !== undefined && !decision) {
        throw new BadRequestException('판단 내용은 비워둘 수 없습니다.');
      }
      if (dto.reason !== undefined && !reason) {
        throw new BadRequestException('판단 근거는 비워둘 수 없습니다.');
      }

      await client.query(
        `
        UPDATE qa_decision_memories
        SET build_history_id = $2,
          build_version_snapshot = $3,
          inspection_id = $4,
          inspection_version_snapshot = $5,
          decision_type = $6,
          risk_level = $7,
          decision = $8,
          reason = $9,
          conditions = $10,
          related_url = $12,
          updated_by = $11,
          updated_at = now()
        WHERE id = $1
        `,
        [
          decisionId,
          buildHistory === undefined
            ? existing.build_history_id
            : buildHistory?.id ?? null,
          buildHistory === undefined
            ? existing.build_version_snapshot
            : buildHistory?.version ?? null,
          inspection === undefined
            ? existing.inspection_id
            : inspection?.id ?? null,
          inspection === undefined
            ? existing.inspection_version_snapshot
            : inspection?.version ?? null,
          dto.decisionType ?? existing.decision_type,
          dto.riskLevel === undefined ? existing.risk_level : dto.riskLevel,
          decision ?? existing.decision,
          reason ?? existing.reason,
          dto.conditions === undefined
            ? existing.conditions
            : dto.conditions?.trim() || null,
          userId,
          dto.relatedUrl === undefined ? existing.related_url : dto.relatedUrl,
        ],
      );
    });

    return this.get(decisionId);
  }

  async resolve(
    decisionId: string,
    dto: ResolveQaDecisionDto,
    userId: string,
  ) {
    const resultText = dto.result?.trim();
    if (dto.resolved && !resultText) {
      throw new BadRequestException('해소 결과는 필수입니다.');
    }

    await this.db.transaction(async (client) => {
      const result = await client.query(
        `
        UPDATE qa_decision_memories
        SET status = $2,
          result = CASE WHEN $3 THEN $4 ELSE NULL END,
          resolved_by = CASE WHEN $3 THEN $5::uuid ELSE NULL END,
          resolved_at = CASE WHEN $3 THEN now() ELSE NULL END,
          updated_by = $5,
          updated_at = now()
        WHERE id = $1
        RETURNING id
        `,
        [
          decisionId,
          dto.resolved ? 'RESOLVED' : 'OPEN',
          dto.resolved,
          resultText ?? null,
          userId,
        ],
      );
      if (!result.rowCount) {
        throw new NotFoundException('QA 판단 기록을 찾을 수 없습니다.');
      }
    });
    return this.get(decisionId);
  }

  private async requireProject(client: PoolClient, projectId: string) {
    const result = await client.query(
      `SELECT id FROM projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    if (!result.rowCount) {
      throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    }
  }

  private async requireBuildHistory(
    client: PoolClient,
    buildHistoryId: string,
    projectId: string,
  ): Promise<LinkedRecord> {
    const result = await client.query<LinkedRecord>(
      `SELECT id, project_id, version FROM build_histories WHERE id = $1 LIMIT 1`,
      [buildHistoryId],
    );
    const buildHistory = result.rows[0];
    if (!buildHistory) {
      throw new BadRequestException('연결할 빌드 히스토리를 찾을 수 없습니다.');
    }
    if (buildHistory.project_id !== projectId) {
      throw new BadRequestException(
        '같은 프로젝트의 빌드 히스토리만 연결할 수 있습니다.',
      );
    }
    return buildHistory;
  }

  private async requireInspection(
    client: PoolClient,
    inspectionId: string,
    projectId: string,
  ): Promise<LinkedRecord> {
    const result = await client.query<LinkedRecord>(
      `SELECT id, project_id, version FROM inspections WHERE id = $1 LIMIT 1`,
      [inspectionId],
    );
    const inspection = result.rows[0];
    if (!inspection) {
      throw new BadRequestException('연결할 Build Inspection을 찾을 수 없습니다.');
    }
    if (inspection.project_id !== projectId) {
      throw new BadRequestException(
        '같은 프로젝트의 Build Inspection만 연결할 수 있습니다.',
      );
    }
    return inspection;
  }
}
