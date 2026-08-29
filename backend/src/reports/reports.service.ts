import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DbService) {}

  async getInspectionReport(inspectionId: string) {
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
        creator.name AS created_by_name,
        i.created_at,
        i.updated_at
      FROM inspections i
      JOIN projects p
        ON p.id = i.project_id
      JOIN users creator
        ON creator.id = i.created_by
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
        ii.id AS inspection_item_id,
        ii.source_test_item_id,
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

    const items = itemsResult.rows;

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
    const untestedCount = totalCount - testedCount;

    const priorityItems = items
      .filter(
        (item) =>
          item.status === 'FAIL' ||
          item.status === 'SKIP',
      )
      .sort((a, b) => {
        const priority = {
          FAIL: 0,
          SKIP: 1,
        };

        const aPriority =
          priority[a.status as 'FAIL' | 'SKIP'];

        const bPriority =
          priority[b.status as 'FAIL' | 'SKIP'];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        if (
          a.category_sort_order !==
          b.category_sort_order
        ) {
          return (
            a.category_sort_order -
            b.category_sort_order
          );
        }

        return (
          a.item_sort_order -
          b.item_sort_order
        );
      });

    return {
      inspection: inspectionResult.rows[0],

      summary: {
        total_count: totalCount,
        tested_count: testedCount,
        untested_count: untestedCount,
        pass_count: passCount,
        fail_count: failCount,
        skip_count: skipCount,
        is_completed:
          totalCount > 0 &&
          testedCount === totalCount,
      },

      priority_items: priorityItems,

      all_results: items,
    };
  }
}