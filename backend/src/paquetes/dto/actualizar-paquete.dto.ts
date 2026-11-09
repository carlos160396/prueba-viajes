import { PartialType } from '@nestjs/mapped-types';
import { CrearPaqueteDto } from './crear-paquete.dto';

export class ActualizarPaqueteDto extends PartialType(CrearPaqueteDto, {
  skipNullProperties: false,
}) {}
