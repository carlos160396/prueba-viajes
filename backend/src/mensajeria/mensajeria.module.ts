import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MensajeriaService } from './mensajeria.service';

@Module({
  imports: [ConfigModule],
  providers: [MensajeriaService],
  exports: [MensajeriaService],
})
export class MensajeriaModule {}
