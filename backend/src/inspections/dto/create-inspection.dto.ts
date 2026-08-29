import { IsIn, IsString, IsUUID, Length } from 'class-validator';

export const INSPECTION_PLATFORMS = ['IOS', 'ANDROID'] as const;

export const INSPECTION_TYPES = [
  'NEW',
  'RESUBMISSION',
  'DEVELOPMENT_REVIEW',
] as const;

export type InspectionPlatform = (typeof INSPECTION_PLATFORMS)[number];
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export class CreateInspectionDto {
  @IsUUID()
  projectId!: string;

  @IsIn(INSPECTION_PLATFORMS)
  platform!: InspectionPlatform;

  @IsString()
  @Length(1, 150)
  version!: string;

  @IsIn(INSPECTION_TYPES)
  inspectionType!: InspectionType;

  @IsString()
  @Length(1, 500)
  testDevices!: string;
}