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
import { CreateQaDecisionDto } from './dto/create-qa-decision.dto';
import { ListQaDecisionsDto } from './dto/list-qa-decisions.dto';
import { ResolveQaDecisionDto } from './dto/resolve-qa-decision.dto';
import { UpdateQaDecisionDto } from './dto/update-qa-decision.dto';
import { QaDecisionsService } from './qa-decisions.service';

@Controller('qa-decisions')
@UseGuards(AuthGuard, RolesGuard)
export class QaDecisionsController {
  constructor(private readonly qaDecisions: QaDecisionsService) {}

  @Get()
  list(@Query() query: ListQaDecisionsDto) {
    return this.qaDecisions.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.qaDecisions.get(id);
  }

  @Post()
  @Roles('LEADER', 'ADMIN')
  create(
    @Body() dto: CreateQaDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qaDecisions.create(dto, user.id);
  }

  @Patch(':id/resolve')
  @Roles('LEADER', 'ADMIN')
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveQaDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qaDecisions.resolve(id, dto, user.id);
  }

  @Patch(':id')
  @Roles('LEADER', 'ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQaDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qaDecisions.update(id, dto, user.id);
  }
}
