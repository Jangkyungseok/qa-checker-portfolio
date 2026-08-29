import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly db: DbService) {}

  async list(includeInactive = false) {
    const result = await this.db.query(
      `
      SELECT
        c.id,
        c.parent_id,
        c.name,
        c.description,
        c.sort_order,
        c.is_active,
        c.default_ios,
        c.default_android,
        c.default_new,
        c.default_resubmission,
        c.default_development_review,
        c.created_by,
        c.updated_by,
        c.created_at,
        c.updated_at,
        COUNT(ti.id)::int AS item_count
      FROM categories c
      LEFT JOIN test_items ti
        ON ti.category_id = c.id
      WHERE ($1::boolean = true OR c.is_active = true)
      GROUP BY c.id
      ORDER BY
        c.sort_order ASC,
        c.name ASC
      `,
      [includeInactive],
    );

    return result.rows;
  }

  async create(
    dto: CreateCategoryDto,
    userId: string,
  ) {
    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    const result = await this.db.query(
      `
      INSERT INTO categories (
        parent_id,
        name,
        description,
        sort_order,
        default_ios,
        default_android,
        default_new,
        default_resubmission,
        default_development_review,
        created_by,
        updated_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $10
      )
      RETURNING
        id,
        parent_id,
        name,
        description,
        sort_order,
        is_active,
        default_ios,
        default_android,
        default_new,
        default_resubmission,
        default_development_review,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
      [
        dto.parentId ?? null,
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.sortOrder ?? 0,
        dto.defaultIos ?? true,
        dto.defaultAndroid ?? true,
        dto.defaultNew ?? true,
        dto.defaultResubmission ?? true,
        dto.defaultDevelopmentReview ?? false,
        userId,
      ],
    );

    return result.rows[0];
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    userId: string,
  ) {
    await this.ensureCategoryExists(id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new NotFoundException(
          '카테고리를 자기 자신의 하위 카테고리로 지정할 수 없습니다.',
        );
      }

      await this.ensureCategoryExists(dto.parentId);
    }

    const result = await this.db.query(
      `
      UPDATE categories
      SET
        parent_id = COALESCE($2, parent_id),
        name = COALESCE($3, name),
        description = CASE
          WHEN $4::boolean = true THEN $5
          ELSE description
        END,
        sort_order = COALESCE($6, sort_order),
        default_ios = COALESCE($7, default_ios),
        default_android = COALESCE($8, default_android),
        default_new = COALESCE($9, default_new),
        default_resubmission = COALESCE($10, default_resubmission),
        default_development_review = COALESCE(
          $11,
          default_development_review
        ),
        updated_by = $12,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        parent_id,
        name,
        description,
        sort_order,
        is_active,
        default_ios,
        default_android,
        default_new,
        default_resubmission,
        default_development_review,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
      [
        id,
        dto.parentId ?? null,
        dto.name?.trim() ?? null,
        dto.description !== undefined,
        dto.description?.trim() || null,
        dto.sortOrder ?? null,
        dto.defaultIos ?? null,
        dto.defaultAndroid ?? null,
        dto.defaultNew ?? null,
        dto.defaultResubmission ?? null,
        dto.defaultDevelopmentReview ?? null,
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
      UPDATE categories
      SET
        is_active = $2,
        updated_by = $3,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        parent_id,
        name,
        description,
        sort_order,
        is_active,
        default_ios,
        default_android,
        default_new,
        default_resubmission,
        default_development_review,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
      [id, isActive, userId],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        '카테고리를 찾을 수 없습니다.',
      );
    }

    return result.rows[0];
  }

  private async ensureCategoryExists(id: string) {
    const result = await this.db.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result.rowCount) {
      throw new NotFoundException(
        '카테고리를 찾을 수 없습니다.',
      );
    }
  }
}