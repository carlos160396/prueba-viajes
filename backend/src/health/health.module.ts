import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { MensajeriaModule } from '../mensajeria/mensajeria.module';
import { HealthController } from './health.controller';

@Module({
  imports: [RedisModule, MensajeriaModule],
  controllers: [HealthController],
})
export class HealthModule {}
