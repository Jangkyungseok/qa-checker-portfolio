import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BuildHistoriesService } from './build-histories.service';
import { CreateBuildHistoryDto } from './dto/create-build-history.dto';
import { UpdateBuildHistoryDto } from './dto/update-build-history.dto';

@Controller('build-histories')
@UseGuards(AuthGuard, RolesGuard)
export class BuildHistoriesController {
  constructor(private readonly buildHistories: BuildHistoriesService) {}

  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.buildHistories.list(projectId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.buildHistories.get(id);
  }

  @Post()
  @Roles('LEADER', 'ADMIN')
  create(
    @Body() dto: CreateBuildHistoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.buildHistories.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('LEADER', 'ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBuildHistoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.buildHistories.update(id, dto, user.id);
  }
}
