import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
export const PRIORITIES = ['IMMEDIATE','HIGH','NORMAL','LOW'] as const;
export const STATUSES = ['NEW','REQUESTED','RE_REQUESTED','IN_PROGRESS','RESPONDED','VERIFIED','SKIP_REQUESTED','SKIP_CONFIRMED'] as const;
export const FREQUENCIES = ['PERCENT_100','PERCENT_70','PERCENT_50','PERCENT_30','PERCENT_1'] as const;
const trim = ({value}:{value:unknown}) => typeof value==='string'?value.trim():value;
const code = ({value}:{value:unknown}) => typeof value==='string'?value.trim().toUpperCase()||null:value;
export class CreateDefectDto {
  @IsUUID() projectId!: string;
  @Transform(trim) @IsString() @Length(1,200) title!: string;
  @Transform(trim) @IsString() @Length(1,10000) stepsToReproduce!: string;
  @Transform(trim) @IsString() @Length(1,10000) description!: string;
  @Transform(trim) @IsString() @Length(1,10000) fixDirection!: string;
  @IsIn(FREQUENCIES) reproducibility!: string;
  @IsIn(PRIORITIES) priority!: string;
  @Transform(trim) @IsString() @Length(1,200) buildVersion!: string;
  @Transform(trim) @IsString() @Length(1,500) deviceOs = '공통';
  @IsOptional() @Transform(code) @Matches(/^(?:BUG|ISSUE)-\d{1,18}$/) relatedIssueCode?: string|null;
}
export class UpdateDefectDto {
  @IsInt() @Min(1) version!: number;
  @ValidateIf((_o,v)=>v!==undefined) @Transform(trim) @IsString() @Length(1,200) title?:string;
  @ValidateIf((_o,v)=>v!==undefined) @Transform(trim) @IsString() @Length(1,10000) stepsToReproduce?:string;
  @ValidateIf((_o,v)=>v!==undefined) @Transform(trim) @IsString() @Length(1,10000) description?:string;
  @ValidateIf((_o,v)=>v!==undefined) @Transform(trim) @IsString() @Length(1,10000) fixDirection?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(FREQUENCIES) reproducibility?:string;
  @ValidateIf((_o,v)=>v!==undefined) @IsIn(PRIORITIES) priority?:string;
  @ValidateIf((_o,v)=>v!==undefined) @Transform(trim) @IsString() @Length(1,200) buildVersion?:string;
  @ValidateIf((_o,v)=>v!==undefined) @Transform(trim) @IsString() @Length(1,500) deviceOs?:string;
  @IsOptional() @Transform(code) @Matches(/^(?:BUG|ISSUE)-\d{1,18}$/) relatedIssueCode?:string|null;
}
export class DefectStatusDto {
  @IsInt() @Min(1) version!:number;
  @IsIn(STATUSES) status!:string;
}
export class ListDefectsDto {
  @IsUUID() projectId!:string;
  @IsOptional() @Transform(trim) @IsString() @Length(0,200) search?:string;
  @IsOptional() @IsIn(STATUSES) status?:string;
  @IsOptional() @IsIn(PRIORITIES) priority?:string;
  @IsOptional() @IsIn(FREQUENCIES) reproducibility?:string;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page=1;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=30;
}
export class CommentDto { @Transform(trim) @IsString() @Length(1,5000) body!:string; }
export class UpdateCommentDto extends CommentDto { @IsInt() @Min(1) version!:number; }
