import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearPaquetes1794190682646 implements MigrationInterface {
    name = 'CrearPaquetes1794190682646'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "paquetes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "destino" character varying(150) NOT NULL, "fecha_inicio" date NOT NULL, "fecha_fin" date NOT NULL, "precio" numeric(12,2) NOT NULL, "cupo_total" integer NOT NULL, "cupo_disponible" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_paquetes_cupo" CHECK ("cupo_total" >= 0 AND "cupo_disponible" >= 0 AND "cupo_disponible" <= "cupo_total"), CONSTRAINT "CHK_paquetes_fechas" CHECK ("fecha_fin" >= "fecha_inicio"), CONSTRAINT "CHK_paquetes_precio" CHECK ("precio" >= 0), CONSTRAINT "PK_320a0c4f75ec47ec218c5024e63" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_60ef55954f0de5a41478bd9d80" ON "paquetes"  ("fecha_inicio") `);
        await queryRunner.query(`CREATE INDEX "IDX_eeb65a897d5ad7f1517960b7f5" ON "paquetes"  ("precio") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_eeb65a897d5ad7f1517960b7f5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_60ef55954f0de5a41478bd9d80"`);
        await queryRunner.query(`DROP TABLE "paquetes"`);
    }

}
