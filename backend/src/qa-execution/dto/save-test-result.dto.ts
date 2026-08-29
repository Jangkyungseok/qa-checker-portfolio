import {
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export const TEST_RESULT_STATUSES = [
  'PASS',
  'FAIL',
  'SKIP',
] as const;

export type TestResultStatus =
  (typeof TEST_RESULT_STATUSES)[number];

export class SaveTestResultDto {
  @IsIn(TEST_RESULT_STATUSES)
  status!: TestResultStatus;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  memo?: string;
}