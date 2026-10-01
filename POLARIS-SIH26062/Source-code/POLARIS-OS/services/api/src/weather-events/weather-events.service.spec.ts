import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PrismaService } from '../prisma.service.js';
import { WeatherEventsService } from './weather-events.service.js';

describe('WeatherEventsService', () => {
  let service: WeatherEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherEventsService,
        {
          provide: PrismaService,
          useValue: {
            weatherEvent: {
              findMany: vi.fn(),
              create: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WeatherEventsService>(WeatherEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
