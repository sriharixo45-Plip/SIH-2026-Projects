import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { Public } from './auth/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('db')
  @Public()
  async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
