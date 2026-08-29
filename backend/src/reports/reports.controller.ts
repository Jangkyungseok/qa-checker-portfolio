import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
  ) {}

  @Get('inspections/:inspectionId')
  getInspectionReport(
    @Param('inspectionId') inspectionId: string,
  ) {
    return this.reports.getInspectionReport(
      inspectionId,
    );
  }
}