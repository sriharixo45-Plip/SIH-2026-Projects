import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateInventoryStockDto } from './dto/create-inventory-stock.dto.js';
import { UpdateInventoryStockDto } from './dto/update-inventory-stock.dto.js';
import { InventoryStocksService } from './inventory-stocks.service.js';

@Controller('inventory-stocks')
export class InventoryStocksController {
  constructor(private readonly inventoryStocksService: InventoryStocksService) {}

  @Get()
  findAll() {
    return this.inventoryStocksService.findAll();
  }

  @Get('station/:stationId')
  findByStation(@Param('stationId') stationId: string) {
    return this.inventoryStocksService.findByStation(stationId);
  }

  @Get('item/:itemCatalogId')
  findByItem(@Param('itemCatalogId') itemCatalogId: string) {
    return this.inventoryStocksService.findByItem(itemCatalogId);
  }

  @Get('station/:stationId/item/:itemCatalogId')
  findByStationItem(
    @Param('stationId') stationId: string,
    @Param('itemCatalogId') itemCatalogId: string,
  ) {
    return this.inventoryStocksService.findByStationItem(stationId, itemCatalogId);
  }

  @Get(':id')
  findOne(@Param('id') stockId: string) {
    return this.inventoryStocksService.findOne(stockId);
  }

  @Post()
  create(@Body() dto: CreateInventoryStockDto) {
    return this.inventoryStocksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') stockId: string, @Body() dto: UpdateInventoryStockDto) {
    return this.inventoryStocksService.update(stockId, dto);
  }
}
