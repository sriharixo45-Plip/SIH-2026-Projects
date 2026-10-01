import { Controller, Get, Param, Query } from '@nestjs/common';
import { VesselService } from './vessels.service.js';
import { AisStreamService } from './aisstream.service.js';

@Controller('vessels')
export class VesselsController {
  constructor(private readonly vessels: VesselService, private readonly ais: AisStreamService) {}

  @Get('status')
  status() { return this.ais.status(); }

  @Get('track/:mmsi')
  track(@Param('mmsi') mmsi: string, @Query('limit') limit?: string) {
    return this.vessels.track(mmsi, limit);
  }

  @Get(':mmsi')
  findOne(@Param('mmsi') mmsi: string) { return this.vessels.findOne(mmsi); }

  @Get()
  findAll(@Query('q') query?: string, @Query('status') status?: string) { return this.vessels.findAll(query, status); }
}
