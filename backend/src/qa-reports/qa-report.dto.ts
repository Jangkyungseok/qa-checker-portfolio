import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export const PURPOSES = ['FEATURED','REQUIRED_CONSIDERATION','PRIORITY_CONSIDERATION','FUTURE_CONSIDERATION','NEEDS_REVIEW'] as const;
export class QaReportLinkDto {
  @IsUUID() defectId!: string;
  @IsIn(PURPOSES) purpose!: typeof PURPOSES[number];
  @IsOptional() @IsUUID() attachmentId?: string | null;
}
// Full draft representation; partial empty content is valid until PDF generation.
export class QaReportDto {
  @IsString() @MaxLength(200) title = '';
  @IsString() @MaxLength(200) targetBuild = '';
  @IsOptional() @IsString() @MaxLength(200) filterBuildVersion?: string | null;
  @IsOptional() @IsString() @MaxLength(10) testStartDate?: string | null;
  @IsOptional() @IsString() @MaxLength(10) testEndDate?: string | null;
  @IsString() @MaxLength(2000) testScope = '';
  @IsString() @MaxLength(2000) testEnvironment = '';
  @IsString() @MaxLength(2000) testMethod = '';
  @IsObject() considerations: Record<string,string> = {};
  @IsString() @MaxLength(10000) leadOpinion = '';
  @IsArray() @ArrayMaxSize(405) @ValidateNested({each:true}) @Type(()=>QaReportLinkDto) links: QaReportLinkDto[] = [];
}
export class UpdateQaReportDto extends QaReportDto {
  @IsInt() @Min(1) version!: number;
}
export class QaCandidatesDto {
  @Type(()=>Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
export class QaPdfDto {
  @IsInt() @Min(1) version!: number;
}
