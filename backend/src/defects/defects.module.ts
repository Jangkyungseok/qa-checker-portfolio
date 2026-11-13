import { StorageModule } from '../storage/storage.module';
import { DefectFileStore } from './defect-file-store';
import { DefectAttachmentsService } from './defect-attachments.service';
import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';
import { DefectReportService } from './defect-report.service';
import { DefectExportService } from './defect-export.service';

@Module({ imports:[StorageModule], controllers:[DefectsController], providers:[DefectsService,DefectReportService,DefectExportService,DefectAttachmentsService,DefectFileStore,AuthGuard], exports:[DefectReportService,DefectAttachmentsService] })
export class DefectsModule {}
