import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthStatus } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** GET /api/health : utile pour vérifier que le backend est bien lancé */
  @Get('health')
  health(): Promise<HealthStatus> {
    return this.appService.health();
  }
}
