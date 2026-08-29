import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../common/auth.guard';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateTestItemDto } from './dto/create-test-item.dto';
import { UpdateTestItemDto } from './dto/update-test-item.dto';
import { TestItemsService } from './test-items.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

@Controller('test-items')
@UseGuards(AuthGuard, RolesGuard)
export class TestItemsController {
  constructor(
    private readonly testItems: TestItemsService,
  ) {}

  @Get()
  list(
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.testItems.list(
      includeInactive === 'true',
    );
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Body() dto: CreateTestItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.testItems.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTestItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.testItems.update(
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
    return this.testItems.setActive(
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
    return this.testItems.setActive(
      id,
      false,
      user.id,
    );
  }

  @Get(':id/attachments')
  attachments(
    @Param('id') id: string,
  ) {
    return this.testItems.listAttachments(id);
  }

  @Post(':id/attachments')
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (
        _request,
        file,
        callback,
      ) => {
        if (
          !ALLOWED_MIME_TYPES.has(
            file.mimetype,
          )
        ) {
          callback(
            new BadRequestException(
              'PNG, JPG, WEBP, PDF 파일만 업로드할 수 있습니다.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException(
        '업로드할 파일을 선택해주세요.',
      );
    }

    return this.testItems.addAttachment(
      id,
      file,
      user.id,
    );
  }

  @Delete(
    ':id/attachments/:attachmentId',
  )
  @Roles('ADMIN')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId')
    attachmentId: string,
  ) {
    return this.testItems.removeAttachment(
      id,
      attachmentId,
    );
  }

  @Get(
    ':id/attachments/:attachmentId/file',
  )
  async openAttachment(
    @Param('id') id: string,
    @Param('attachmentId')
    attachmentId: string,
  ) {
    const attachment =
      await this.testItems.getAttachmentFile(
        id,
        attachmentId,
      );

    return new StreamableFile(
      attachment.stream,
      {
        type: attachment.mime_type,
        disposition:
          `inline; filename*=UTF-8''${encodeURIComponent(
            attachment.original_name,
          )}`,
      },
    );
  }
}
