import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { StorageModule } from '../storage/storage.module';
import { QaExecutionController } from './qa-execution.controller';
import { QaExecutionService } from './qa-execution.service';

@Module({
  imports: [StorageModule],
  controllers: [QaExecutionController],
  providers: [
    QaExecutionService,
    AuthGuard,
    RolesGuard,
  ],
})
export class QaExecutionModule {}