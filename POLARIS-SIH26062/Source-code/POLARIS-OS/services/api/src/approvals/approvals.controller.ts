import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { CreateApprovalDto } from './dto/create-approval.dto.js';
import { DecideApprovalDto } from './dto/decide-approval.dto.js';
import { ApprovalsService } from './approvals.service.js';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  findAll() {
    return this.approvalsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') approvalId: string) {
    return this.approvalsService.findOne(approvalId);
  }

  @Post()
  create(@Body() dto: CreateApprovalDto) {
    return this.approvalsService.create(dto);
  }

  @Post(':id/decide')
  decide(@Param('id') approvalId: string, @Body() dto: DecideApprovalDto, @Req() req: any) {
    return this.approvalsService.decide(approvalId, { ...dto, decided_by: req.user.sub });
  }
}
