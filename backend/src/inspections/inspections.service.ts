import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  CreateInspectionDto,
  InspectionPlatform,
  InspectionType,
} from './dto/create-inspection.dto';

@Injectable()
export class InspectionsService {
  constructor(private readonly db: DbService) {}

  async list(projectId?: string) {
    const result = await this.db.query(
      `
      SELECT
        i.id,
        i.project_id,
        p.name AS project_name,
        i.platform,
        i.version,
        i.inspection_type,
        i.test_devices,
        i.created_by,
        u.name AS created_by_name,
        i.created_at,
        i.updated_at,
        COUNT(ii.id)::int AS item_count,
        COUNT(tr.id)::int AS tested_count
      FROM inspections i
      JOIN projects p
        ON p.id = i.project_id
      JOIN users u
        ON u.id = i.created_by
      LEFT JOIN inspection_items ii
        ON ii.inspection_id = i.id
      LEFT JOIN test_results tr
        ON tr.inspection_item_id = ii.id
      WHERE ($1::uuid IS NULL OR i.project_id = $1)
      GROUP BY
        i.id,
        p.name,
        u.name
      ORDER BY i.created_at DESC
      `,
      [projectId ?? null],
    );

    return result.rows;
  }

  async create(dto: CreateInspectionDto, userId: string) {
    const version = dto.version.trim();
    const testDevices = dto.testDevices.trim();

    return this.db.transaction(async (client) => {
      const projectResult = await client.query(
        `
        SELECT id, name, is_active
        FROM projects
        WHERE id = $1
        LIMIT 1
        `,
        [dto.projectId],
      );

      const project = projectResult.rows[0];

      if (!project) {
        throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
      }

      if (!project.is_active) {
        throw new NotFoundException('비활성화된 프로젝트에는 검사를 생성할 수 없습니다.');
      }

      const inspectionResult = await client.query(
        `
        INSERT INTO inspections (
          project_id,
          platform,
          version,
          inspection_type,
          test_devices,
          created_by
        )
        VALUES (
          $1,
          $2::platform_type,
          $3,
          $4::inspection_type,
          $5,
          $6
        )
        RETURNING
          id,
          project_id,
          platform,
          version,
          inspection_type,
          test_devices,
          created_by,
          created_at,
          updated_at
        `,
        [
          dto.projectId,
          dto.platform,
          version,
          dto.inspectionType,
          testDevices,
          userId,
        ],
      );

      const inspection = inspectionResult.rows[0];

      const snapshotResult = await client.query(
        `
        INSERT INTO inspection_items (
          inspection_id,
          source_test_item_id,
          category_name,
          category_sort_order,
          item_title,
          check_content,
          test_method,
          reference_note,
          item_sort_order
        )
        SELECT
          $1,
          ti.id,
          c.name,
          c.sort_order,
          ti.title,
          ti.check_content,
          ti.test_method,
          ti.reference_note,
          ti.sort_order
        FROM test_items ti
        JOIN categories c
          ON c.id = ti.category_id
        WHERE ti.is_active = true
          AND c.is_active = true
          AND (
            ($2::platform_type = 'IOS' AND ti.applies_ios = true)
            OR
            ($2::platform_type = 'ANDROID' AND ti.applies_android = true)
          )
          AND (
            ($3::inspection_type = 'NEW' AND ti.applies_new = true)
            OR
            ($3::inspection_type = 'RESUBMISSION' AND ti.applies_resubmission = true)
            OR
            (
              $3::inspection_type = 'DEVELOPMENT_REVIEW'
              AND ti.applies_development_review = true
            )
          )
        ORDER BY
          c.sort_order ASC,
          ti.sort_order ASC
        RETURNING id
        `,
        [inspection.id, dto.platform, dto.inspectionType],
      );

      await client.query(
        `
        INSERT INTO inspection_item_attachments (
          inspection_item_id,
          original_name,
          mime_type,
          file_size,
          file_path
        )
        SELECT
          ii.id,
          tia.original_name,
          tia.mime_type,
          tia.file_size,
          tia.file_path
        FROM inspection_items ii
        JOIN test_item_attachments tia
          ON tia.test_item_id = ii.source_test_item_id
        WHERE ii.inspection_id = $1
        ORDER BY
          ii.created_at ASC,
          tia.created_at ASC
        `,
        [inspection.id],
      );

      return {
        ...inspection,
        project_name: project.name,
        snapshot_item_count: snapshotResult.rowCount ?? 0,
      };
    });
  }


  async remove(inspectionId: string) {
    return this.db.transaction(async (client) => {
      const inspectionResult = await client.query(
        `
        SELECT
          i.id,
          i.project_id,
          p.name AS project_name,
          i.version,
          i.platform,
          i.inspection_type
        FROM inspections i
        JOIN projects p
          ON p.id = i.project_id
        WHERE i.id = $1
        LIMIT 1
        `,
        [inspectionId],
      );

      const inspection = inspectionResult.rows[0];

      if (!inspection) {
        throw new NotFoundException('검사를 찾을 수 없습니다.');
      }

      const itemIdsResult = await client.query(
        `
        SELECT id
        FROM inspection_items
        WHERE inspection_id = $1
        `,
        [inspectionId],
      );

      const itemIds = itemIdsResult.rows.map(
        (row) => row.id,
      );

      if (itemIds.length > 0) {
        await client.query(
          `
          DELETE FROM inspection_item_attachments
          WHERE inspection_item_id = ANY($1::uuid[])
          `,
          [itemIds],
        );

        await client.query(
          `
          DELETE FROM test_result_history
          WHERE inspection_item_id = ANY($1::uuid[])
          `,
          [itemIds],
        );

        await client.query(
          `
          DELETE FROM test_results
          WHERE inspection_item_id = ANY($1::uuid[])
          `,
          [itemIds],
        );
      }

      await client.query(
        `
        DELETE FROM inspection_items
        WHERE inspection_id = $1
        `,
        [inspectionId],
      );

      await client.query(
        `
        DELETE FROM inspections
        WHERE id = $1
        `,
        [inspectionId],
      );

      return {
        success: true,
        deletedInspection: {
          id: inspection.id,
          project_id: inspection.project_id,
          project_name: inspection.project_name,
          version: inspection.version,
          platform: inspection.platform,
          inspection_type: inspection.inspection_type,
        },
      };
    });
  }

}
