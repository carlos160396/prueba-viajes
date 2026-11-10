import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { RolUsuario, Usuario } from '../usuarios/usuario.entity';
import { Paquete } from '../paquetes/paquete.entity';

// Carga usuarios y paquetes de demostración. Se puede ejecutar varias veces.
async function seed(): Promise<void> {
  try {
    await dataSource.initialize();

    // Contraseña compartida exclusivamente para usuarios de prueba.
    const passwordHash = await bcrypt.hash('Prueba123!', 12);

    const usuarios = [
      {
        nombre: 'Administrador de prueba',
        email: 'admin@example.com',
        passwordHash,
        rol: RolUsuario.ADMIN,
      },
      {
        nombre: 'Agente de prueba',
        email: 'agente@example.com',
        passwordHash,
        rol: RolUsuario.AGENTE,
      },
      {
        nombre: 'Cliente de prueba',
        email: 'cliente@example.com',
        passwordHash,
        rol: RolUsuario.CLIENTE,
      },
    ];

    // Los UUID fijos identifican estos paquetes de demostración.
    // Así, ejecutar el seed otra vez no crea nuevos paquetes iguales.
    const paquetes = [
      // Más destinos para probar filtros y paginación.
      // Los IDs fijos evitan duplicarlos al reiniciar Docker.
      {
        id: '44444444-4444-4444-8444-444444444444',
        destino: 'Mazatlán',
        fechaInicio: '2027-01-22',
        fechaFin: '2027-01-25',
        precio: '3500.00',
        cupoTotal: 25,
        cupoDisponible: 25,
        activo: true,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        destino: 'Oaxaca',
        fechaInicio: '2027-02-05',
        fechaFin: '2027-02-09',
        precio: '4800.00',
        cupoTotal: 18,
        cupoDisponible: 18,
        activo: true,
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        destino: 'Ciudad de México',
        fechaInicio: '2027-02-18',
        fechaFin: '2027-02-21',
        precio: '3900.00',
        cupoTotal: 30,
        cupoDisponible: 30,
        activo: true,
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        destino: 'Mérida',
        fechaInicio: '2027-03-12',
        fechaFin: '2027-03-17',
        precio: '5900.00',
        cupoTotal: 16,
        cupoDisponible: 16,
        activo: true,
      },
      {
        id: '88888888-8888-4888-8888-888888888888',
        destino: 'San Miguel de Allende',
        fechaInicio: '2027-03-20',
        fechaFin: '2027-03-23',
        precio: '3200.00',
        cupoTotal: 14,
        cupoDisponible: 14,
        activo: true,
      },
      {
        id: '99999999-9999-4999-8999-999999999999',
        destino: 'Huatulco',
        fechaInicio: '2027-04-02',
        fechaFin: '2027-04-07',
        precio: '7200.00',
        cupoTotal: 20,
        cupoDisponible: 20,
        activo: true,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        destino: 'Chiapas',
        fechaInicio: '2027-04-10',
        fechaFin: '2027-04-16',
        precio: '6100.00',
        cupoTotal: 22,
        cupoDisponible: 22,
        activo: true,
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        destino: 'Guanajuato',
        fechaInicio: '2027-04-23',
        fechaFin: '2027-04-26',
        precio: '2800.00',
        cupoTotal: 24,
        cupoDisponible: 24,
        activo: true,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        destino: 'Riviera Maya',
        fechaInicio: '2027-05-08',
        fechaFin: '2027-05-14',
        precio: '9500.00',
        cupoTotal: 18,
        cupoDisponible: 18,
        activo: true,
      },
    ];

    // Guardamos ambos grupos en una transacción:
    // si una inserción falla, se revierten las de esta ejecución.
    await dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(Usuario)
        .values(usuarios)
        .orIgnore()
        .execute();

      await manager
        .createQueryBuilder()
        .insert()
        .into(Paquete)
        .values(paquetes)
        .orIgnore()
        .execute();
    });

    // orIgnore omite registros que ya existen.
    // No sobrescribimos contraseñas, precios ni cupos modificados.
    console.log('Seed de usuarios y paquetes completado.');
  } finally {
    // Cerramos la conexión incluso si ocurre un error.
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seed().catch((error: unknown) => {
  console.error('Falló el seed:', error);
  process.exitCode = 1;
});
