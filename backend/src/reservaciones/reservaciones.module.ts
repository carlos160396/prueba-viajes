import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Reservacion } from './reservacion.entity';
import { ReservacionesController } from './reservaciones.controller';
import { ReservacionesService } from './reservaciones.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservacion]), AuthModule, RedisModule],
  controllers: [ReservacionesController],
  providers: [ReservacionesService],
  exports: [TypeOrmModule],
})
export class ReservacionesModule {}
