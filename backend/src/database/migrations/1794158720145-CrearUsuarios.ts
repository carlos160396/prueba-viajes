import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearUsuarios1794158720145 implements MigrationInterface {
  name = 'CrearUsuarios1794158720145';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."usuarios_rol_enum" AS ENUM('admin', 'agente', 'cliente')`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(120) NOT NULL, "email" character varying(254) NOT NULL, "password_hash" text NOT NULL, "rol" "public"."usuarios_rol_enum" NOT NULL DEFAULT 'cliente', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "usuarios"`);
    await queryRunner.query(`DROP TYPE "public"."usuarios_rol_enum"`);
  }
}
