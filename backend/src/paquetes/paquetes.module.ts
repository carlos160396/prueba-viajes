import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Paquete } from './paquete.entity';
import { PaquetesController } from './paquetes.controller';
import { PaquetesService } from './paquetes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Paquete]), AuthModule],
  controllers: [PaquetesController],
  providers: [PaquetesService],
  exports: [TypeOrmModule],
})
export class PaquetesModule {}
