import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service.js';

export interface HealthStatus {
  status: 'ok';
  database: 'up' | 'down';
  /** "llm" si une clé API est configurée, sinon "mock" (réponses simulées) */
  aiMode: 'llm' | 'mock';
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Vérifie que l'API tourne, que la base répond et indique le mode IA. */
  async health(): Promise<HealthStatus> {
    let database: HealthStatus['database'] = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    return {
      status: 'ok',
      database,
      aiMode: this.config.get<string>('LLM_API_KEY') ? 'llm' : 'mock',
    };
  }
}
