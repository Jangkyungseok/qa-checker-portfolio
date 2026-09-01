import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BuildHistoriesModule } from './build-histories/build-histories.module';
import { CategoriesModule } from './categories/categories.module';
import { DbModule } from './db/db.module';
import { InspectionsModule } from './inspections/inspections.module';
import { ProjectsModule } from './projects/projects.module';
import { QaExecutionModule } from './qa-execution/qa-execution.module';
import { ReportsModule } from './reports/reports.module';
import { TestItemsModule } from './test-items/test-items.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    BuildHistoriesModule,
    UsersModule,
    ProjectsModule,
    InspectionsModule,
    CategoriesModule,
    TestItemsModule,
    QaExecutionModule,
    ReportsModule,
  ],
})
export class AppModule {}