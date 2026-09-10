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
import {
  BUILD_HISTORY_IMPACT_AREAS,
  BUILD_HISTORY_RISK_LEVELS,
  BUILD_HISTORY_SOURCE_TYPES,
  BuildHistoryImpactArea,
  BuildHistoryRiskLevel,
  BuildHistorySourceType,
} from './create-build-history.dto';

export class UpdateBuildHistoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  version?: string;

  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  changeSummary?: string;

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
