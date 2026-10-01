import { Module } from '@nestjs/common';
import { ItemCatalogController } from './item-catalog.controller.js';
import { ItemCatalogService } from './item-catalog.service.js';

@Module({
  controllers: [ItemCatalogController],
  providers: [ItemCatalogService],
  exports: [ItemCatalogService],
})
export class ItemCatalogModule {}
