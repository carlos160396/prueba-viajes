import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Paquete } from './paquete.entity';
import { PaquetesController } from './paquetes.controller';
import { PaquetesService } from './paquetes.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Paquete]), AuthModule, RedisModule],
  controllers: [PaquetesController],
  providers: [PaquetesService],
  exports: [TypeOrmModule],
})
export class PaquetesModule {}
