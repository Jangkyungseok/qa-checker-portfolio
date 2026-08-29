import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  defaultIos?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultAndroid?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultNew?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultResubmission?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultDevelopmentReview?: boolean;
}