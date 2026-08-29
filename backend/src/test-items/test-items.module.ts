import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { TestItemsController } from './test-items.controller';
import { TestItemsService } from './test-items.service';

@Module({
  controllers: [TestItemsController],
  providers: [
    TestItemsService,
    AuthGuard,
    RolesGuard,
  ],
})
export class TestItemsModule {}
