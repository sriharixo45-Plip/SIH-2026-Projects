import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { WeatherEventsController } from './weather-events.controller.js';
import { WeatherEventsService } from './weather-events.service.js';

describe('WeatherEventsController', () => {
  let controller: WeatherEventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeatherEventsController],
      providers: [
        {
          provide: WeatherEventsService,
          useValue: {
            findAll: vi.fn(),
            findByStation: vi.fn(),
            create: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WeatherEventsController>(WeatherEventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
