import { StorageModule } from '../storage/storage.module';
import { DefectFileStore } from './defect-file-store';
import { DefectAttachmentsService } from './defect-attachments.service';
import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';

@Module({ imports:[StorageModule], controllers:[DefectsController], providers:[DefectsService,DefectAttachmentsService,DefectFileStore,AuthGuard] })
export class DefectsModule {}
