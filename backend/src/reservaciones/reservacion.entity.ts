import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { Paquete } from '../paquetes/paquete.entity';

export enum EstadoPago {
  PENDIENTE = 'PENDIENTE',
  PAGADA = 'PAGADA',
  CANCELADA = 'CANCELADA',
}

@Entity('reservaciones')
@Check('CHK_reservaciones_personas', '"numero_personas" > 0')
@Check('CHK_reservaciones_precio', '"precio_unitario" >= 0')
@Check(
  'CHK_reservaciones_total',
  '"total" = "precio_unitario" * "numero_personas"',
)
export class Reservacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId!: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Usuario;

  @Index()
  @Column({ name: 'creada_por_id', type: 'uuid' })
  creadaPorId!: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creada_por_id' })
  creadaPor!: Usuario;

  @Index()
  @Column({ name: 'paquete_id', type: 'uuid' })
  paqueteId!: string;

  @ManyToOne(() => Paquete, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paquete_id' })
  paquete!: Paquete;

  @Column({ name: 'numero_personas', type: 'integer' })
  numeroPersonas!: number;

  @Column({
    name: 'precio_unitario',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  precioUnitario!: string;

  @Column({ type: 'numeric', precision: 22, scale: 2 })
  total!: string;

  @Column({
    name: 'estado_pago',
    type: 'enum',
    enum: EstadoPago,
    default: EstadoPago.PENDIENTE,
  })
  estadoPago!: EstadoPago;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
