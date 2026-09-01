import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { BuildHistoriesController } from './build-histories.controller';
import { BuildHistoriesService } from './build-histories.service';

@Module({
  controllers: [BuildHistoriesController],
  providers: [BuildHistoriesService, AuthGuard, RolesGuard],
})
export class BuildHistoriesModule {}
