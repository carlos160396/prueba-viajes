import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { RequestAutenticada } from '../auth/types/usuario-autenticado';
import { RolUsuario } from '../usuarios/usuario.entity';
import { CrearReservacionDto } from './dto/crear-reservacion.dto';
import { ReservacionesService } from './reservaciones.service';
import { ListarReservacionesDto } from './dto/listar-reservaciones.dto';

@Controller('reservaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservacionesController {
  constructor(private readonly reservacionesService: ReservacionesService) {}

  @Post()
  @Roles(RolUsuario.CLIENTE, RolUsuario.AGENTE)
  crear(
    @Body() datos: CrearReservacionDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.reservacionesService.crear(datos, request.user);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.AGENTE, RolUsuario.CLIENTE)
  listar(
    @Query() filtros: ListarReservacionesDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.reservacionesService.listar(filtros, request.user);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.AGENTE, RolUsuario.CLIENTE)
  buscarPorId(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestAutenticada,
  ) {
    return this.reservacionesService.buscarPorId(id, request.user);
  }
}
