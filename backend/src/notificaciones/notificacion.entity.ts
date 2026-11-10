import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Reservacion } from '../reservaciones/reservacion.entity';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'evento_id',
    type: 'uuid',
    unique: true,
  })
  eventoId!: string;

  @Index()
  @Column({ name: 'reservacion_id', type: 'uuid' })
  reservacionId!: string;

  @ManyToOne(() => Reservacion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'reservacion_id' })
  reservacion!: Reservacion;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;
}
