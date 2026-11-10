import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearReservaciones1794200825574 implements MigrationInterface {
  name = 'CrearReservaciones1794200825574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reservaciones_estado_pago_enum" AS ENUM('PENDIENTE', 'PAGADA', 'CANCELADA')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reservaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cliente_id" uuid NOT NULL, "creada_por_id" uuid NOT NULL, "paquete_id" uuid NOT NULL, "numero_personas" integer NOT NULL, "precio_unitario" numeric(12,2) NOT NULL, "total" numeric(22,2) NOT NULL, "estado_pago" "public"."reservaciones_estado_pago_enum" NOT NULL DEFAULT 'PENDIENTE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_reservaciones_total" CHECK ("total" = "precio_unitario" * "numero_personas"), CONSTRAINT "CHK_reservaciones_precio" CHECK ("precio_unitario" >= 0), CONSTRAINT "CHK_reservaciones_personas" CHECK ("numero_personas" > 0), CONSTRAINT "PK_b843ef2b40adbe20b2cc163ac0e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0a6a8c4c50b30d95ccf613db28" ON "reservaciones"  ("cliente_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5785f8c3abab18712de18ed2db" ON "reservaciones"  ("creada_por_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c9909312451fd54213c8406625" ON "reservaciones"  ("paquete_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reservaciones" ADD CONSTRAINT "FK_0a6a8c4c50b30d95ccf613db282" FOREIGN KEY ("cliente_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservaciones" ADD CONSTRAINT "FK_5785f8c3abab18712de18ed2db9" FOREIGN KEY ("creada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservaciones" ADD CONSTRAINT "FK_c9909312451fd54213c8406625d" FOREIGN KEY ("paquete_id") REFERENCES "paquetes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservaciones" DROP CONSTRAINT "FK_c9909312451fd54213c8406625d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservaciones" DROP CONSTRAINT "FK_5785f8c3abab18712de18ed2db9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservaciones" DROP CONSTRAINT "FK_0a6a8c4c50b30d95ccf613db282"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c9909312451fd54213c8406625"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5785f8c3abab18712de18ed2db"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0a6a8c4c50b30d95ccf613db28"`,
    );
    await queryRunner.query(`DROP TABLE "reservaciones"`);
    await queryRunner.query(
      `DROP TYPE "public"."reservaciones_estado_pago_enum"`,
    );
  }
}
