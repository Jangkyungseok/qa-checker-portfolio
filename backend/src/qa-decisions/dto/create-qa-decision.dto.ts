import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, IsUrl, Length } from 'class-validator';

export const QA_DECISION_TYPES = [
  'RELEASE',
  'RISK_ACCEPTANCE',
  'TEST_SCOPE',
  'REGRESSION',
  'DEFECT_DISPOSITION',
  'OTHER',
  'DELIVERY_ISSUE',
  'REMAINING_ISSUE',
  'REMAINING_TEST',
  'LIVE_ISSUE_RESPONSE',
] as const;

export const QA_DECISION_RISK_LEVELS = [
  'UNASSESSED',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export const QA_DECISION_STATUSES = ['OPEN', 'RESOLVED'] as const;

export type QaDecisionType = (typeof QA_DECISION_TYPES)[number];
export type QaDecisionRiskLevel = (typeof QA_DECISION_RISK_LEVELS)[number];
export type QaDecisionStatus = (typeof QA_DECISION_STATUSES)[number];

export class CreateQaDecisionDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  buildHistoryId?: string;

  @IsOptional()
  @IsUUID()
  inspectionId?: string;

  @IsIn(QA_DECISION_TYPES)
  decisionType!: QaDecisionType;

  @IsOptional()
  @IsIn(QA_DECISION_RISK_LEVELS)
  riskLevel?: QaDecisionRiskLevel | null;

  @IsString()
  @Length(1, 10000)
  decision!: string;

  @IsString()
  @Length(1, 10000)
  reason!: string;

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
