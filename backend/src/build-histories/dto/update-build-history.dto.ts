import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

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
}
