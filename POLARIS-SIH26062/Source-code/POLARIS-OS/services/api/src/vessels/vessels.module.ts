import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module.js';
import { AisStreamService } from './aisstream.service.js';
import { VesselService } from './vessels.service.js';
import { VesselsController } from './vessels.controller.js';

@Module({ imports: [PrismaModule], controllers: [VesselsController], providers: [AisStreamService, VesselService] })
export class VesselsModule {}
