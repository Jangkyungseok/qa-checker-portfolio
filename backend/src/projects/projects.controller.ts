import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.projects.list(includeInactive === 'true');
  }

  @Post()
  @Roles('LEADER', 'ADMIN')
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
    return this.projects.create(dto.name, user.id);
  }

  @Patch(':id/activate')
  @Roles('LEADER', 'ADMIN')
  activate(@Param('id') id: string) {
    return this.projects.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @Roles('LEADER', 'ADMIN')
  deactivate(@Param('id') id: string) {
    return this.projects.setActive(id, false);
  }
}
