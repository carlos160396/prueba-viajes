import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgregarActivoPaquetes1794198357087 implements MigrationInterface {
  name = 'AgregarActivoPaquetes1794198357087';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "paquetes" ADD "activo" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "paquetes" DROP COLUMN "activo"`);
  }
}
