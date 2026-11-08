import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { RolUsuario, Usuario } from '../usuarios/usuario.entity';

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

    await dataSource
      .createQueryBuilder()
      .insert()
      .into(Usuario)
      .values(usuarios)
      .orIgnore()
      .execute();

    console.log('Seed de usuarios completado.');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seed().catch((error: unknown) => {
  console.error('Falló el seed:', error);
  process.exitCode = 1;
});
