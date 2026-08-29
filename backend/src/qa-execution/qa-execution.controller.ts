import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { RolesGuard } from '../common/roles.guard';
import { SaveTestResultDto } from './dto/save-test-result.dto';
import { QaExecutionService } from './qa-execution.service';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class QaExecutionController {
  constructor(
    private readonly qaExecution: QaExecutionService,
  ) {}

  @Get('inspections/:inspectionId/items')
  getInspectionItems(
    @Param('inspectionId') inspectionId: string,
  ) {
    return this.qaExecution.getInspectionItems(
      inspectionId,
    );
  }

  @Get(
    'inspection-items/:inspectionItemId/attachments/:attachmentId/file',
  )
  async openAttachment(
    @Param('inspectionItemId')
    inspectionItemId: string,
    @Param('attachmentId')
    attachmentId: string,
  ) {
    const attachment =
      await this.qaExecution.getAttachmentFile(
        inspectionItemId,
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

  @Put('inspection-items/:inspectionItemId/result')
  saveResult(
    @Param('inspectionItemId')
    inspectionItemId: string,
    @Body() dto: SaveTestResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qaExecution.saveResult(
      inspectionItemId,
      dto,
      user.id,
    );
  }
}