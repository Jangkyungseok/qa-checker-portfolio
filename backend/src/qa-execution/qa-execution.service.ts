import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createReadStream,
  existsSync,
} from 'fs';
import { join } from 'path';
import { DbService } from '../db/db.service';
import { SaveTestResultDto } from './dto/save-test-result.dto';

@Injectable()
export class QaExecutionService {
  constructor(private readonly db: DbService) {}

  async getInspectionItems(inspectionId: string) {
    const inspectionResult = await this.db.query(
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
        i.created_at,
        i.updated_at
      FROM inspections i
      JOIN projects p
        ON p.id = i.project_id
      WHERE i.id = $1
      LIMIT 1
      `,
      [inspectionId],
    );

    if (!inspectionResult.rowCount) {
      throw new NotFoundException(
        '검사를 찾을 수 없습니다.',
      );
    }

    const itemsResult = await this.db.query(
      `
      SELECT
        ii.id,
        ii.inspection_id,
        ii.source_test_item_id,
        ti.tc_no,
        CASE
          WHEN ti.tc_no IS NULL THEN NULL
          ELSE CONCAT(
            'TC-',
            CASE
              WHEN ti.tc_no < 10000
                THEN LPAD(ti.tc_no::text, 4, '0')
              ELSE ti.tc_no::text
            END
          )
        END AS tc_code,
        ii.category_name,
        ii.category_sort_order,
        ii.item_title,
        ii.check_content,
        ii.test_method,
        ii.reference_note,
        ii.item_sort_order,
        tr.status,
        tr.memo,
        tr.tested_by,
        tester.name AS tested_by_name,
        tr.tested_at,
        tr.updated_at AS result_updated_at
      FROM inspection_items ii
      LEFT JOIN test_items ti
        ON ti.id = ii.source_test_item_id
      LEFT JOIN test_results tr
        ON tr.inspection_item_id = ii.id
      LEFT JOIN users tester
        ON tester.id = tr.tested_by
      WHERE ii.inspection_id = $1
      ORDER BY
        ii.category_sort_order ASC,
        ii.item_sort_order ASC,
        ii.created_at ASC
      `,
      [inspectionId],
    );

    const itemIds = itemsResult.rows.map(
      (item) => item.id,
    );

    const historyMap = new Map<string, any[]>();
    const attachmentMap =
      new Map<string, any[]>();

    if (itemIds.length > 0) {
      const attachmentResult =
        await this.db.query(
          `
          SELECT
            id,
            inspection_item_id,
            original_name,
            mime_type,
            file_size,
            created_at
          FROM inspection_item_attachments
          WHERE inspection_item_id = ANY($1::uuid[])
          ORDER BY
            inspection_item_id ASC,
            created_at ASC
          `,
          [itemIds],
        );

      for (
        const attachment of
        attachmentResult.rows
      ) {
        const existing =
          attachmentMap.get(
            attachment.inspection_item_id,
          ) ?? [];

        existing.push(attachment);

        attachmentMap.set(
          attachment.inspection_item_id,
          existing,
        );
      }

      const historyResult = await this.db.query(
        `
        SELECT
          h.id,
          h.inspection_item_id,
          h.status,
          h.memo,
          h.changed_by,
          u.name AS changed_by_name,
          h.changed_at
        FROM test_result_history h
        JOIN users u
          ON u.id = h.changed_by
        WHERE h.inspection_item_id = ANY($1::uuid[])
        ORDER BY
          h.inspection_item_id ASC,
          h.changed_at DESC
        `,
        [itemIds],
      );

      for (const history of historyResult.rows) {
        const existing =
          historyMap.get(history.inspection_item_id) ?? [];

        if (existing.length < 2) {
          existing.push(history);
          historyMap.set(
            history.inspection_item_id,
            existing,
          );
        }
      }
    }

    const items = itemsResult.rows.map((item) => ({
      ...item,
      attachments:
        attachmentMap.get(item.id) ?? [],
      recent_history:
        historyMap.get(item.id) ?? [],
    }));

    const passCount = items.filter(
      (item) => item.status === 'PASS',
    ).length;

    const failCount = items.filter(
      (item) => item.status === 'FAIL',
    ).length;

    const skipCount = items.filter(
      (item) => item.status === 'SKIP',
    ).length;

    const testedCount =
      passCount + failCount + skipCount;

    const totalCount = items.length;

    return {
      inspection: inspectionResult.rows[0],
      progress: {
        total_count: totalCount,
        tested_count: testedCount,
        untested_count: totalCount - testedCount,
        pass_count: passCount,
        fail_count: failCount,
        skip_count: skipCount,
        is_completed:
          totalCount > 0 &&
          testedCount === totalCount,
      },
      items,
    };
  }

  async getAttachmentFile(
    inspectionItemId: string,
    attachmentId: string,
  ) {
    const result = await this.db.query(
      `
      SELECT
        id,
        original_name,
        mime_type,
        file_path
      FROM inspection_item_attachments
      WHERE id = $1
        AND inspection_item_id = $2
      LIMIT 1
      `,
      [attachmentId, inspectionItemId],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        '검사 참고 자료를 찾을 수 없습니다.',
      );
    }

    const attachment = result.rows[0];

    const absolutePath = join(
      process.cwd(),
      attachment.file_path,
    );

    if (!existsSync(absolutePath)) {
      throw new NotFoundException(
        '저장된 참고 자료 파일을 찾을 수 없습니다.',
      );
    }

    return {
      ...attachment,
      stream: createReadStream(
        absolutePath,
      ),
    };
  }

  async saveResult(
    inspectionItemId: string,
    dto: SaveTestResultDto,
    userId: string,
  ) {
    const memo = dto.memo?.trim() || null;

    return this.db.transaction(async (client) => {
      const itemResult = await client.query(
        `
        SELECT
          ii.id,
          ii.inspection_id,
          ii.item_title
        FROM inspection_items ii
        WHERE ii.id = $1
        LIMIT 1
        `,
        [inspectionItemId],
      );

      if (!itemResult.rowCount) {
        throw new NotFoundException(
          '검사 TC를 찾을 수 없습니다.',
        );
      }

      const result = await client.query(
        `
        INSERT INTO test_results (
          inspection_item_id,
          status,
          memo,
          tested_by
        )
        VALUES (
          $1,
          $2::test_result_status,
          $3,
          $4
        )
        ON CONFLICT (inspection_item_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          memo = EXCLUDED.memo,
          tested_by = EXCLUDED.tested_by,
          tested_at = now(),
          updated_at = now()
        RETURNING
          id,
          inspection_item_id,
          status,
          memo,
          tested_by,
          tested_at,
          updated_at
        `,
        [
          inspectionItemId,
          dto.status,
          memo,
          userId,
        ],
      );

      await client.query(
        `
        INSERT INTO test_result_history (
          inspection_item_id,
          status,
          memo,
          changed_by
        )
        VALUES (
          $1,
          $2::test_result_status,
          $3,
          $4
        )
        `,
        [
          inspectionItemId,
          dto.status,
          memo,
          userId,
        ],
      );

      const userResult = await client.query(
        `
        SELECT name
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId],
      );

      return {
        ...result.rows[0],
        item_title:
          itemResult.rows[0].item_title,
        tested_by_name:
          userResult.rows[0]?.name ?? null,
      };
    });
  }
}