import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MensajeriaModule } from '../mensajeria/mensajeria.module';
import { RedisModule } from '../redis/redis.module';
import { Reservacion } from './reservacion.entity';
import { ReservacionesController } from './reservaciones.controller';
import { ReservacionesService } from './reservaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservacion]),
    AuthModule,
    RedisModule,
    MensajeriaModule,
  ],
  controllers: [ReservacionesController],
  providers: [ReservacionesService],
  exports: [TypeOrmModule],
})
export class ReservacionesModule {}
