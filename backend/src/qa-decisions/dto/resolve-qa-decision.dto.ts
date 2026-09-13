import { IsBoolean, IsString, Length, ValidateIf } from 'class-validator';

export class ResolveQaDecisionDto {
  @IsBoolean()
  resolved!: boolean;

  @ValidateIf((dto: ResolveQaDecisionDto) => dto.resolved)
  @IsString()
  @Length(1, 10000)
  result?: string;
}
