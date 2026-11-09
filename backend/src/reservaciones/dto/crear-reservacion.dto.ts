import { IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class CrearReservacionDto {
  @IsUUID('4')
  paqueteId!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  numeroPersonas!: number;

  @ValidateIf((_objeto, valor) => valor !== undefined)
  @IsUUID('4')
  clienteId?: string;
}
