import { IsIn } from 'class-validator';
import { DefectReportDto } from './defect-report.dto';

export class DefectExportDto extends DefectReportDto {
  @IsIn(['xlsx', 'csv']) format!: 'xlsx' | 'csv';
}
