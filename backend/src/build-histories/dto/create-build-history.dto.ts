import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export const BUILD_HISTORY_SOURCE_TYPES = [
  'MANUAL',
  'VCS',
  'BUILD_SYSTEM',
  'ISSUE_TRACKER',
] as const;

export const BUILD_HISTORY_RISK_LEVELS = [
  'UNASSESSED',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export const BUILD_HISTORY_IMPACT_AREAS = [
  'ACCOUNT',
  'PAYMENT',
  'NETWORK',
  'UI',
  'DATA',
  'GAMEPLAY',
  'SERVER',
  'SDK',
  'PERFORMANCE',
] as const;

export type BuildHistorySourceType =
  (typeof BUILD_HISTORY_SOURCE_TYPES)[number];
export type BuildHistoryRiskLevel =
  (typeof BUILD_HISTORY_RISK_LEVELS)[number];
export type BuildHistoryImpactArea =
  (typeof BUILD_HISTORY_IMPACT_AREAS)[number];

export class CreateBuildHistoryDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @Length(1, 150)
  version!: string;

  @IsDateString()
  deliveredAt!: string;

  @IsString()
  @Length(1, 10000)
  changeSummary!: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  qaNotes?: string;

  @IsOptional()
  @IsIn(BUILD_HISTORY_SOURCE_TYPES)
  sourceType?: BuildHistorySourceType;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  sourceBranch?: string | null;

  @IsOptional()
  @IsIn(BUILD_HISTORY_RISK_LEVELS)
  riskLevel?: BuildHistoryRiskLevel | null;

  @IsOptional()
  @IsBoolean()
  regressionRequired?: boolean | null;

  @IsOptional()
  @IsBoolean()
  additionalTestRequired?: boolean | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  inspectionIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(BUILD_HISTORY_IMPACT_AREAS, { each: true })
  impactAreas?: BuildHistoryImpactArea[];
}
