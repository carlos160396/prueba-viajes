import 'reflect-metadata';
import { config } from 'dotenv';
import { join, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { Paquete } from '../paquetes/paquete.entity';
import { Reservacion } from '../reservaciones/reservacion.entity';

config({ path: resolve(process.cwd(), '../.env') });

const env = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: env.getOrThrow<string>('POSTGRES_HOST'),
  port: Number(env.getOrThrow<string>('POSTGRES_PORT')),
  username: env.getOrThrow<string>('POSTGRES_USER'),
  password: env.getOrThrow<string>('POSTGRES_PASSWORD'),
  database: env.getOrThrow<string>('POSTGRES_DB'),
  entities: [Usuario, Paquete, Reservacion],
  migrations: [join(__dirname, 'migrations', '*.js')],
  synchronize: false,
});
