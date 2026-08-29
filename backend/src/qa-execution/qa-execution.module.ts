import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { QaExecutionController } from './qa-execution.controller';
import { QaExecutionService } from './qa-execution.service';

@Module({
  controllers: [QaExecutionController],
  providers: [
    QaExecutionService,
    AuthGuard,
    RolesGuard,
  ],
})
export class QaExecutionModule {}