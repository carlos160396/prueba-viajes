import { IsEnum } from 'class-validator';
import { EstadoPago } from '../reservacion.entity';

export class CambiarEstadoDto {
  @IsEnum(EstadoPago)
  estadoPago!: EstadoPago;
}
