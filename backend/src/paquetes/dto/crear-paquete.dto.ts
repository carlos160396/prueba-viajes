import {
  IsDateString,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearPaqueteDto {
  @IsString()
  @MaxLength(150)
  @Matches(/\S/, { message: 'El destino no puede estar vacío' })
  destino!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaInicio!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaFin!: string;

  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'El precio debe ser un importe no negativo con máximo 2 decimales',
  })
  precio!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  cupoTotal!: number;
}
