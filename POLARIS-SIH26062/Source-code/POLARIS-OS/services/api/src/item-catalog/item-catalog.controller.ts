import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateItemCatalogDto } from './dto/create-item-catalog.dto.js';
import { UpdateItemCatalogDto } from './dto/update-item-catalog.dto.js';
import { ItemCatalogService } from './item-catalog.service.js';

@Controller('item-catalog')
export class ItemCatalogController {
  constructor(private readonly itemCatalogService: ItemCatalogService) {}

  @Get()
  findAll() {
    return this.itemCatalogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') itemId: string) {
    return this.itemCatalogService.findOne(itemId);
  }

  @Post()
  create(@Body() dto: CreateItemCatalogDto) {
    return this.itemCatalogService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') itemId: string, @Body() dto: UpdateItemCatalogDto) {
    return this.itemCatalogService.update(itemId, dto);
  }

  @Delete(':id')
  remove(@Param('id') itemId: string, @Body() body: { deleted_by?: string } = {}) {
    return this.itemCatalogService.remove(itemId, body.deleted_by);
  }

  @Post(':id/restore')
  restore(@Param('id') itemId: string) {
    return this.itemCatalogService.restore(itemId);
  }
}
