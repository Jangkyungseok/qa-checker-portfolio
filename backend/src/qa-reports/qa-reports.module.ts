import { Module } from '@nestjs/common';
import { DefectsModule } from '../defects/defects.module';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { QaReportsController } from './qa-reports.controller';
import { QaReportsService } from './qa-reports.service';
import { QaReportPdfService } from './qa-report-pdf.service';
@Module({imports:[DefectsModule],controllers:[QaReportsController],providers:[QaReportsService,QaReportPdfService,AuthGuard,RolesGuard]})
export class QaReportsModule {}
