import { Global, Module } from '@nestjs/common'
import { AiService } from './ai.service.js'

// @Global : AiService est injectable dans tous les modules (plant, invoice, terrain...)
@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
