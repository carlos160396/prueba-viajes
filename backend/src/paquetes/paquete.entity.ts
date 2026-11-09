import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('paquetes')
@Check('CHK_paquetes_precio', '"precio" >= 0')
@Check('CHK_paquetes_fechas', '"fecha_fin" >= "fecha_inicio"')
@Check(
  'CHK_paquetes_cupo',
  '"cupo_total" >= 0 AND "cupo_disponible" >= 0 AND "cupo_disponible" <= "cupo_total"',
)
export class Paquete {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  destino!: string;

  @Index()
  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio!: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin!: string;

  @Index()
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  precio!: string;

  @Column({ name: 'cupo_total', type: 'integer' })
  cupoTotal!: number;

  @Column({ name: 'cupo_disponible', type: 'integer' })
  cupoDisponible!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;
}
