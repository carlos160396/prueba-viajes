import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const inicio = process.hrtime.bigint();

    res.setHeader('X-Request-Id', requestId);
    res.locals.requestId = requestId;

    let registrado = false;

    const registrar = (interrumpida: boolean) => {
      if (registrado) {
        return;
      }

      registrado = true;

      const duracionMs = Number(process.hrtime.bigint() - inicio) / 1_000_000;

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          nivel: 'info',
          requestId,
          metodo: req.method,
          ruta: req.path,
          statusCode: res.statusCode,
          duracionMs: Number(duracionMs.toFixed(2)),
          interrumpida,
        }),
      );
    };

    res.once('finish', () => registrar(false));

    res.once('close', () => {
      if (!res.writableFinished) {
        registrar(true);
      }
    });

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configuracion = new DocumentBuilder()
    .setTitle('API de viajes')
    .setDescription('Administración de paquetes y reservaciones')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documento = SwaggerModule.createDocument(app, configuracion);

  SwaggerModule.setup('docs', app, documento);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
