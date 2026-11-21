import { Body, Controller, HttpCode, Injectable, Module, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator'
import { AiService } from '../ai/ai.service.js'
import { DashboardModule, DashboardService } from '../dashboard/dashboard.module.js'

export type Lang = 'fr' | 'en' | 'ar'

class ChatMessage {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @IsString()
  @Length(1, 2000)
  content!: string
}

export class ChatDto {
  @IsArray()
  @ArrayMaxSize(30, { message: 'Conversation trop longue : commencez-en une nouvelle.' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  messages!: ChatMessage[]

  @IsOptional()
  @IsIn(['fr', 'en', 'ar'])
  lang?: Lang

  /** Page sur laquelle se trouve l'utilisateur (pour adapter la réponse) */
  @IsOptional()
  @IsString()
  @Length(0, 100)
  page?: string
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly ai: AiService,
  ) {}

  async chat(dto: ChatDto) {
    const question = [...dto.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    // Le contexte vient des données réelles de l'application (mêmes calculs que le tableau de bord)
    const context = await this.dashboard.summary()
    return this.ai.assistantReply(question, dto.lang ?? 'fr', context, dto.page)
  }
}

/** POST /api/assistant/chat : assistant conversationnel (réponse simulée sans clé LLM) */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  chat(@Body() dto: ChatDto) {
    return this.assistant.chat(dto)
  }
}

@Module({ imports: [DashboardModule], controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
