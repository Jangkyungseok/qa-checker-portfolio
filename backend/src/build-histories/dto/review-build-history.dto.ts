import { IsBoolean } from 'class-validator';

export class ReviewBuildHistoryDto {
  @IsBoolean()
  reviewed!: boolean;
}
