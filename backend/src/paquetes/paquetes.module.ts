import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paquete } from './paquete.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Paquete])],
  exports: [TypeOrmModule],
})
export class PaquetesModule {}
