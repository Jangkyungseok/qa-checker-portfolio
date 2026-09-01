import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateBuildHistoryDto } from './dto/create-build-history.dto';
import { UpdateBuildHistoryDto } from './dto/update-build-history.dto';

@Injectable()
export class BuildHistoriesService {
  constructor(private readonly db: DbService) {}

  async list(projectId?: string) {
    const result = await this.db.query(
      `
      SELECT
        bh.id,
        bh.project_id,
        p.name AS project_name,
        bh.version,
        to_char(bh.delivered_at, 'YYYY-MM-DD') AS delivered_at,
        bh.change_summary,
        bh.qa_notes,
        bh.created_by,
        creator.name AS created_by_name,
        bh.updated_by,
        updater.name AS updated_by_name,
        bh.created_at,
        bh.updated_at
      FROM build_histories bh
      JOIN projects p ON p.id = bh.project_id
      JOIN users creator ON creator.id = bh.created_by
      JOIN users updater ON updater.id = bh.updated_by
      WHERE ($1::uuid IS NULL OR bh.project_id = $1)
      ORDER BY bh.delivered_at DESC, bh.created_at DESC
      `,
      [projectId ?? null],
    );

    return result.rows;
  }

  async get(historyId: string) {
    const result = await this.db.query(
      `
      SELECT
        bh.id,
        bh.project_id,
        p.name AS project_name,
        bh.version,
        to_char(bh.delivered_at, 'YYYY-MM-DD') AS delivered_at,
        bh.change_summary,
        bh.qa_notes,
        bh.created_by,
        creator.name AS created_by_name,
        bh.updated_by,
        updater.name AS updated_by_name,
        bh.created_at,
        bh.updated_at
      FROM build_histories bh
      JOIN projects p ON p.id = bh.project_id
      JOIN users creator ON creator.id = bh.created_by
      JOIN users updater ON updater.id = bh.updated_by
      WHERE bh.id = $1
      LIMIT 1
      `,
      [historyId],
    );

    if (!result.rowCount) {
      throw new NotFoundException('빌드 히스토리를 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  async create(dto: CreateBuildHistoryDto, userId: string) {
    const projectResult = await this.db.query(
      `SELECT id, name, is_active FROM projects WHERE id = $1 LIMIT 1`,
      [dto.projectId],
    );

    const project = projectResult.rows[0];
    if (!project || !project.is_active) {
      throw new NotFoundException('활성 프로젝트를 찾을 수 없습니다.');
    }

    const result = await this.db.query(
      `
      INSERT INTO build_histories (
        project_id,
        version,
        delivered_at,
        change_summary,
        qa_notes,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3::date, $4, $5, $6, $6)
      RETURNING id
      `,
      [
        dto.projectId,
        dto.version.trim(),
        dto.deliveredAt,
        dto.changeSummary.trim(),
        dto.qaNotes?.trim() || null,
        userId,
      ],
    );

    return this.get(result.rows[0].id);
  }

  async update(historyId: string, dto: UpdateBuildHistoryDto, userId: string) {
    const existing = await this.get(historyId);

    await this.db.query(
      `
      UPDATE build_histories
      SET
        version = $2,
        delivered_at = $3::date,
        change_summary = $4,
        qa_notes = $5,
        updated_by = $6,
        updated_at = now()
      WHERE id = $1
      `,
      [
        historyId,
        dto.version?.trim() ?? existing.version,
        dto.deliveredAt ?? existing.delivered_at,
        dto.changeSummary?.trim() ?? existing.change_summary,
        dto.qaNotes === undefined ? existing.qa_notes : dto.qaNotes.trim() || null,
        userId,
      ],
    );

    return this.get(historyId);
  }
}
