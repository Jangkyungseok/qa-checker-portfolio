import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { StorageModule } from '../storage/storage.module';
import { TestItemsController } from './test-items.controller';
import { TestItemsService } from './test-items.service';

@Module({
  imports: [StorageModule],
  controllers: [TestItemsController],
  providers: [
    TestItemsService,
    AuthGuard,
    RolesGuard,
  ],
})
export class TestItemsModule {}
