import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class DefectReportDto {
  @IsUUID() projectId!: string;
  @IsIn(['ALL', '7', '14', '30']) period = 'ALL';
  @IsOptional() @IsString() @Length(1, 200) buildVersion?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) remainingPage = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) rerequestPage = 1;
}
