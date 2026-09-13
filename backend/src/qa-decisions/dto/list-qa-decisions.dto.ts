import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  QA_DECISION_RISK_LEVELS,
  QA_DECISION_STATUSES,
  QA_DECISION_TYPES,
  QaDecisionRiskLevel,
  QaDecisionStatus,
  QaDecisionType,
} from './create-qa-decision.dto';

export class ListQaDecisionsDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsIn(QA_DECISION_STATUSES)
  status?: QaDecisionStatus;

  @IsOptional()
  @IsIn(QA_DECISION_RISK_LEVELS)
  riskLevel?: QaDecisionRiskLevel;

  @IsOptional()
  @IsIn(QA_DECISION_TYPES)
  decisionType?: QaDecisionType;
}
