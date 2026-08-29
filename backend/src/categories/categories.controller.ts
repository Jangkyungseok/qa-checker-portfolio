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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
@UseGuards(AuthGuard, RolesGuard)
export class CategoriesController {
  constructor(
    private readonly categories: CategoriesService,
  ) {}

  @Get()
  list(
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.categories.list(
      includeInactive === 'true',
    );
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.categories.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.categories.update(
      id,
      dto,
      user.id,
    );
  }

  @Patch(':id/activate')
  @Roles('ADMIN')
  activate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.categories.setActive(
      id,
      true,
      user.id,
    );
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.categories.setActive(
      id,
      false,
      user.id,
    );
  }
}