import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser, UserRole } from '../common/auth-user';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UsersService } from './users.service';

class ApproveUserDto {
  @IsIn(['USER', 'LEADER'])
  role!: UserRole;
}

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('pending')
  listPending() {
    return this.users.listPending();
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveUserDto, @CurrentUser() admin: AuthUser) {
    return this.users.approve(id, dto.role, admin.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() admin: AuthUser) {
    return this.users.reject(id, admin.id);
  }
}
