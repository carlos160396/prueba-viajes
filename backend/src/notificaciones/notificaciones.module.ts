import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacion } from './notificacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notificacion])],
  exports: [TypeOrmModule],
})
export class NotificacionesModule {}
