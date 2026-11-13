import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';
import { QaCandidatesDto, QaPdfDto, QaReportDto, UpdateQaReportDto } from './qa-report.dto';
import { QaReportsService } from './qa-reports.service';
import { QaReportPdfService } from './qa-report-pdf.service';

@Controller('projects/:projectId/qa-reports')
@UseGuards(AuthGuard,RolesGuard)
export class QaReportsController {
  constructor(private readonly reports:QaReportsService,private readonly pdf:QaReportPdfService){}
  @Get() list(@Param('projectId',ParseUUIDPipe) p:string){return this.reports.list(p);}
  @Post() @Roles('LEADER','ADMIN') create(@Param('projectId',ParseUUIDPipe) p:string,@Body() dto:QaReportDto,@CurrentUser() u:AuthUser){return this.reports.save(p,dto,u);}
  @Get(':reportId') get(@Param('projectId',ParseUUIDPipe) p:string,@Param('reportId',ParseUUIDPipe) id:string){return this.reports.get(p,id);}
  @Patch(':reportId') @Roles('LEADER','ADMIN') update(@Param('projectId',ParseUUIDPipe) p:string,@Param('reportId',ParseUUIDPipe) id:string,@Body() dto:UpdateQaReportDto,@CurrentUser() u:AuthUser){return this.reports.save(p,dto,u,id);}
  @Get(':reportId/candidates') candidates(@Param('projectId',ParseUUIDPipe) p:string,@Param('reportId',ParseUUIDPipe) id:string,@Query() dto:QaCandidatesDto){return this.reports.candidates(p,id,dto);}
  @Post(':reportId/pdf') @Header('Cache-Control','private, no-store') @Header('Access-Control-Expose-Headers','Content-Disposition')
  async download(@Param('projectId',ParseUUIDPipe) p:string,@Param('reportId',ParseUUIDPipe) id:string,@Body() dto:QaPdfDto){const file=await this.pdf.generate(p,id,dto.version);return new StreamableFile(file.buffer,{type:'application/pdf',disposition:`attachment; filename="QA_Report.pdf"; filename*=UTF-8''${encodeURIComponent(file.filename)}`});}
}
