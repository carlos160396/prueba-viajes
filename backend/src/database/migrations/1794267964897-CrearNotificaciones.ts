import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearNotificaciones1794267964897 implements MigrationInterface {
  name = 'CrearNotificaciones1794267964897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notificaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "evento_id" uuid NOT NULL, "reservacion_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b33896dc459e9231876172de383" UNIQUE ("evento_id"), CONSTRAINT "PK_a9d32a419ff58b53a38b5ef85d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31c5c47960a9ebf4d609fdd2b6" ON "notificaciones"  ("reservacion_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "notificaciones" ADD CONSTRAINT "FK_31c5c47960a9ebf4d609fdd2b62" FOREIGN KEY ("reservacion_id") REFERENCES "reservaciones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notificaciones" DROP CONSTRAINT "FK_31c5c47960a9ebf4d609fdd2b62"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31c5c47960a9ebf4d609fdd2b6"`,
    );
    await queryRunner.query(`DROP TABLE "notificaciones"`);
  }
}
