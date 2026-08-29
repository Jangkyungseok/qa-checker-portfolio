import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { InspectionsService } from './inspections.service';

@Controller('inspections')
@UseGuards(AuthGuard, RolesGuard)
export class InspectionsController {
  constructor(
    private readonly inspections: InspectionsService,
  ) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
  ) {
    return this.inspections.list(projectId);
  }

  @Post()
  @Roles('LEADER', 'ADMIN')
  create(
    @Body() dto: CreateInspectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inspections.create(dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @Param('id') id: string,
  ) {
    return this.inspections.remove(id);
  }
}
