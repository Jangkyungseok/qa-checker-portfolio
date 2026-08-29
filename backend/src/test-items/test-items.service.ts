import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { DbService } from '../db/db.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { CreateTestItemDto } from './dto/create-test-item.dto';
import { UpdateTestItemDto } from './dto/update-test-item.dto';

@Injectable()
export class TestItemsService {
  constructor(
    private readonly db: DbService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async list(includeInactive = false) {
    const result = await this.db.query(
      `
      SELECT
        ti.id,
        ti.tc_no,
        CONCAT(
          'TC-',
          CASE
            WHEN ti.tc_no < 10000
              THEN LPAD(ti.tc_no::text, 4, '0')
            ELSE ti.tc_no::text
          END
        ) AS tc_code,
        ti.category_id,
        c.name AS category_name,
        ti.title,
        ti.check_content,
        ti.test_method,
        ti.reference_note,
        ti.sort_order,
        ti.is_active,
        ti.applies_ios,
        ti.applies_android,
        ti.applies_new,
        ti.applies_resubmission,
        ti.applies_development_review,
        ti.created_by,
        ti.updated_by,
        ti.created_at,
        ti.updated_at
      FROM test_items ti
      JOIN categories c
        ON c.id = ti.category_id
      WHERE ($1::boolean = true OR ti.is_active = true)
      ORDER BY
        c.sort_order ASC,
        ti.sort_order ASC,
        ti.tc_no ASC,
        ti.title ASC
      `,
      [includeInactive],
    );

    return result.rows;
  }

  async create(
    dto: CreateTestItemDto,
    userId: string,
  ) {
    const category =
      await this.getCategoryDefaults(
        dto.categoryId,
      );

    const result = await this.db.query(
      `
      INSERT INTO test_items (
        category_id,
        title,
        check_content,
        test_method,
        reference_note,
        sort_order,
        applies_ios,
        applies_android,
        applies_new,
        applies_resubmission,
        applies_development_review,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $12
      )
      RETURNING
        id,
        tc_no,
        CONCAT(
          'TC-',
          CASE
            WHEN tc_no < 10000
              THEN LPAD(tc_no::text, 4, '0')
            ELSE tc_no::text
          END
        ) AS tc_code,
        category_id,
        title,
        check_content,
        test_method,
        reference_note,
        sort_order,
        is_active,
        applies_ios,
        applies_android,
        applies_new,
        applies_resubmission,
        applies_development_review,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
      [
        dto.categoryId,
        dto.title.trim(),
        dto.checkContent.trim(),
        dto.testMethod.trim(),
        dto.referenceNote?.trim() || null,
        dto.sortOrder ?? 0,
        dto.appliesIos ??
          category.default_ios,
        dto.appliesAndroid ??
          category.default_android,
        dto.appliesNew ??
          category.default_new,
        dto.appliesResubmission ??
          category.default_resubmission,
        dto.appliesDevelopmentReview ??
          category.default_development_review,
        userId,
      ],
    );

    return result.rows[0];
  }

  async update(
    id: string,
    dto: UpdateTestItemDto,
    userId: string,
  ) {
    await this.ensureTestItemExists(id);

    if (dto.categoryId) {
      await this.getCategoryDefaults(
        dto.categoryId,
      );
    }

    const result = await this.db.query(
      `
      UPDATE test_items
      SET
        category_id = COALESCE(
          $2,
          category_id
        ),
        title = COALESCE(
          $3,
          title
        ),
        check_content = COALESCE(
          $4,
          check_content
        ),
        test_method = COALESCE(
          $5,
          test_method
        ),
        reference_note = CASE
          WHEN $6::boolean = true
            THEN $7
          ELSE reference_note
        END,
        sort_order = COALESCE(
          $8,
          sort_order
        ),
        applies_ios = COALESCE(
          $9,
          applies_ios
        ),
        applies_android = COALESCE(
          $10,
          applies_android
        ),
        applies_new = COALESCE(
          $11,
          applies_new
        ),
        applies_resubmission = COALESCE(
          $12,
          applies_resubmission
        ),
        applies_development_review = COALESCE(
          $13,
          applies_development_review
        ),
        updated_by = $14,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        tc_no,
        CONCAT(
          'TC-',
          CASE
            WHEN tc_no < 10000
              THEN LPAD(tc_no::text, 4, '0')
            ELSE tc_no::text
          END
        ) AS tc_code,
        category_id,
        title,
        check_content,
        test_method,
        reference_note,
        sort_order,
        is_active,
        applies_ios,
        applies_android,
        applies_new,
        applies_resubmission,
        applies_development_review,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
      [
        id,
        dto.categoryId ?? null,
        dto.title?.trim() ?? null,
        dto.checkContent?.trim() ?? null,
        dto.testMethod?.trim() ?? null,
        dto.referenceNote !== undefined,
        dto.referenceNote?.trim() || null,
        dto.sortOrder ?? null,
        dto.appliesIos ?? null,
        dto.appliesAndroid ?? null,
        dto.appliesNew ?? null,
        dto.appliesResubmission ?? null,
        dto.appliesDevelopmentReview ??
          null,
        userId,
      ],
    );

    return result.rows[0];
  }

  async setActive(
    id: string,
    isActive: boolean,
    userId: string,
  ) {
    const result = await this.db.query(
      `
      UPDATE test_items
      SET
        is_active = $2,
        updated_by = $3,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        tc_no,
        CONCAT(
          'TC-',
          CASE
            WHEN tc_no < 10000
              THEN LPAD(tc_no::text, 4, '0')
            ELSE tc_no::text
          END
        ) AS tc_code,
        category_id,
        title,
        is_active,
        updated_by,
        updated_at
      `,
      [id, isActive, userId],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        'TC를 찾을 수 없습니다.',
      );
    }

    return result.rows[0];
  }

  async listAttachments(
    testItemId: string,
  ) {
    await this.ensureTestItemExists(
      testItemId,
    );

    const result = await this.db.query(
      `
      SELECT
        id,
        test_item_id,
        original_name,
        mime_type,
        file_size,
        created_by,
        created_at
      FROM test_item_attachments
      WHERE test_item_id = $1
      ORDER BY created_at ASC
      `,
      [testItemId],
    );

    return result.rows;
  }

  async addAttachment(
    testItemId: string,
    file: any,
    userId: string,
  ) {
    await this.ensureTestItemExists(
      testItemId,
    );

    const countResult =
      await this.db.query<{
        count: string;
      }>(
        `
        SELECT COUNT(*)::text AS count
        FROM test_item_attachments
        WHERE test_item_id = $1
        `,
        [testItemId],
      );

    if (
      Number(
        countResult.rows[0]?.count ?? 0,
      ) >= 3
    ) {
      throw new BadRequestException(
        'TC당 참고 자료는 최대 3개까지 등록할 수 있습니다.',
      );
    }

    const extension = extname(
      file.originalname,
    ).toLowerCase();
    const storedName = `${randomUUID()}${extension}`;
    const storagePath =
      `uploads/test-items/${storedName}`;

    const originalName =
      this.normalizeOriginalName(
        file.originalname,
      );

    await this.storage.upload(
      storagePath,
      file.buffer,
      file.mimetype,
    );

    try {
      const result = await this.db.query(
        `
        INSERT INTO test_item_attachments (
          test_item_id,
          original_name,
          stored_name,
          mime_type,
          file_size,
          file_path,
          created_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        RETURNING
          id,
          test_item_id,
          original_name,
          mime_type,
          file_size,
          created_by,
          created_at
        `,
        [
          testItemId,
          originalName,
          storedName,
          file.mimetype,
          file.size,
          storagePath,
          userId,
        ],
      );

      return result.rows[0];
    } catch (error) {
      await this.storage.remove(storagePath);
      throw error;
    }
  }

  async removeAttachment(
    testItemId: string,
    attachmentId: string,
  ) {
    const result = await this.db.query(
      `
      DELETE FROM test_item_attachments
      WHERE id = $1
        AND test_item_id = $2
      RETURNING
        id,
        file_path
      `,
      [attachmentId, testItemId],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        '첨부파일을 찾을 수 없습니다.',
      );
    }

    const attachment = result.rows[0];

    const snapshotReference =
      await this.db.query<{
        count: string;
      }>(
        `
        SELECT COUNT(*)::text AS count
        FROM inspection_item_attachments
        WHERE file_path = $1
        `,
        [attachment.file_path],
      );

    if (
      Number(
        snapshotReference.rows[0]?.count ?? 0,
      ) === 0
    ) {
      await this.storage.remove(
        attachment.file_path,
      );
    }

    return {
      success: true,
      id: attachment.id,
    };
  }

  async getAttachmentFile(
    testItemId: string,
    attachmentId: string,
  ) {
    const result = await this.db.query(
      `
      SELECT
        id,
        original_name,
        mime_type,
        file_path
      FROM test_item_attachments
      WHERE id = $1
        AND test_item_id = $2
      LIMIT 1
      `,
      [attachmentId, testItemId],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        '첨부파일을 찾을 수 없습니다.',
      );
    }

    const attachment = result.rows[0];

    const file = await this.storage.download(
      attachment.file_path,
    );

    return {
      ...attachment,
      stream: file,
    };
  }

  private normalizeOriginalName(
    value: string,
  ) {
    const decoded = Buffer.from(
      value,
      'latin1',
    ).toString('utf8');

    if (
      decoded.includes('\uFFFD')
    ) {
      return value;
    }

    return decoded;
  }

  private async getCategoryDefaults(
    categoryId: string,
  ) {
    const result = await this.db.query(
      `
      SELECT
        id,
        default_ios,
        default_android,
        default_new,
        default_resubmission,
        default_development_review
      FROM categories
      WHERE id = $1
      LIMIT 1
      `,
      [categoryId],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        '카테고리를 찾을 수 없습니다.',
      );
    }

    return result.rows[0];
  }

  private async ensureTestItemExists(
    id: string,
  ) {
    const result = await this.db.query(
      `
      SELECT id
      FROM test_items
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        'TC를 찾을 수 없습니다.',
      );
    }
  }
}
