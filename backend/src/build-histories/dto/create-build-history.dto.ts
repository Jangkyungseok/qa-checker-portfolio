import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

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
}
