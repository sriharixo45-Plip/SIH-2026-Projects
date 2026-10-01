import { Module } from '@nestjs/common';
import { TransportLegsController } from './transport-legs.controller.js';
import { TransportLegsService } from './transport-legs.service.js';

@Module({
  controllers: [TransportLegsController],
  providers: [TransportLegsService],
  exports: [TransportLegsService],
})
export class TransportLegsModule {}
