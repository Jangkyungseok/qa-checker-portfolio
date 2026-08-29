import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateTestItemDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Length(1, 5000)
  checkContent!: string;

  @IsString()
  @Length(1, 10000)
  testMethod!: string;

  @IsOptional()
  @IsString()
  @Length(0, 3000)
  referenceNote?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  appliesIos?: boolean;

  @IsOptional()
  @IsBoolean()
  appliesAndroid?: boolean;

  @IsOptional()
  @IsBoolean()
  appliesNew?: boolean;

  @IsOptional()
  @IsBoolean()
  appliesResubmission?: boolean;

  @IsOptional()
  @IsBoolean()
  appliesDevelopmentReview?: boolean;
}