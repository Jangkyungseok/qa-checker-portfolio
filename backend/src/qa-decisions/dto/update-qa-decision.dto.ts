import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, IsUrl, Length } from 'class-validator';
import {
  QA_DECISION_RISK_LEVELS,
  QA_DECISION_TYPES,
  QaDecisionRiskLevel,
  QaDecisionType,
} from './create-qa-decision.dto';

export class UpdateQaDecisionDto {
  @IsOptional()
  @IsUUID()
  buildHistoryId?: string | null;

  @IsOptional()
  @IsUUID()
  inspectionId?: string | null;

  @IsOptional()
  @IsIn(QA_DECISION_TYPES)
  decisionType?: QaDecisionType;

  @IsOptional()
  @IsIn(QA_DECISION_RISK_LEVELS)
  riskLevel?: QaDecisionRiskLevel | null;

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  decision?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  reason?: string;

  @IsOptional()
  @IsString()
  @Length(0, 10000)
  conditions?: string | null;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false, disallow_auth: true }, { message: '연관 링크는 HTTP/HTTPS URL로 입력해 주세요.' })
  @Length(1, 2048)
  relatedUrl?: string | null;
}
