import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { QaDecisionsController } from './qa-decisions.controller';
import { QaDecisionsService } from './qa-decisions.service';

@Module({
  controllers: [QaDecisionsController],
  providers: [QaDecisionsService, AuthGuard, RolesGuard],
})
export class QaDecisionsModule {}
