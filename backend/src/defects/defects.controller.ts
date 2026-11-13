import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DefectAttachmentsService, EVIDENCE_POLICY, MAX_EVIDENCE_BYTES } from './defect-attachments.service';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, StreamableFile, Header } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { DefectsService } from './defects.service';
import { CommentDto, CreateDefectDto, DefectStatusDto, ListDefectsDto, UpdateCommentDto, UpdateDefectDto } from './dto/defect.dto';

@Controller('defects')
@UseGuards(AuthGuard)
export class DefectsController {
  constructor(private readonly defects: DefectsService, private readonly attachments: DefectAttachmentsService) {}
  @Get() list(@Query() dto: ListDefectsDto, @CurrentUser() user: AuthUser) { return this.defects.list(dto,user); }
  @Get('attachment-policy') policy() { return EVIDENCE_POLICY; }
  @Post() create(@Body() dto: CreateDefectDto, @CurrentUser() user: AuthUser) { return this.defects.create(dto,user); }
  @Get(':id') get(@Param('id',ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.defects.get(id,user); }
  @Patch(':id') update(@Param('id',ParseUUIDPipe) id: string,@Body() dto: UpdateDefectDto,@CurrentUser() user: AuthUser) { return this.defects.update(id,dto,user); }
  @Patch(':id/status') status(@Param('id',ParseUUIDPipe) id: string,@Body() dto: DefectStatusDto,@CurrentUser() user: AuthUser) { return this.defects.status(id,dto,user); }
  @Get(':id/comments') comments(@Param('id',ParseUUIDPipe) id: string) { return this.defects.comments(id); }
  @Post(':id/comments') addComment(@Param('id',ParseUUIDPipe) id: string,@Body() dto: CommentDto,@CurrentUser() user: AuthUser) { return this.defects.addComment(id,dto.body,user); }
  @Patch(':id/comments/:commentId') editComment(@Param('id',ParseUUIDPipe) id: string,@Param('commentId',ParseUUIDPipe) commentId: string,@Body() dto: UpdateCommentDto,@CurrentUser() user: AuthUser) { return this.defects.changeComment(id,commentId,user,dto); }
  @Delete(':id/comments/:commentId') deleteComment(@Param('id',ParseUUIDPipe) id: string,@Param('commentId',ParseUUIDPipe) commentId: string,@CurrentUser() user: AuthUser) { return this.defects.changeComment(id,commentId,user); }
  @Get(':id/activities') activities(@Param('id',ParseUUIDPipe) id: string) { return this.defects.activities(id); }

  @Get(':id/attachments') listAttachments(@Param('id',ParseUUIDPipe) id:string) { return this.attachments.list(id); }
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:MAX_EVIDENCE_BYTES,files:1,fields:1,parts:3}}))
  uploadAttachment(@Param('id',ParseUUIDPipe) id:string,@Body('uploadId',ParseUUIDPipe) uploadId:string,@UploadedFile() file:Express.Multer.File,@CurrentUser() user:AuthUser) { return this.attachments.upload(id,uploadId,file,user); }
  @Delete(':id/attachments/:attachmentId')
  removeAttachment(@Param('id',ParseUUIDPipe) id:string,@Param('attachmentId',ParseUUIDPipe) attachmentId:string,@CurrentUser() user:AuthUser) { return this.attachments.remove(id,attachmentId,user); }
  @Get(':id/attachments/:attachmentId/file')
  @Header('Cache-Control','private, no-store')
  @Header('X-Content-Type-Options','nosniff')
  async attachmentFile(@Param('id',ParseUUIDPipe) id:string,@Param('attachmentId',ParseUUIDPipe) attachmentId:string) {
    const file=await this.attachments.file(id,attachmentId);
    return new StreamableFile(file.data,{type:file.mime_type,length:file.data.length,disposition:"attachment; filename*=UTF-8''"+encodeURIComponent(file.original_filename)});
  }
}
