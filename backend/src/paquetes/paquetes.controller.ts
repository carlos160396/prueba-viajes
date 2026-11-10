import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RolUsuario } from '../usuarios/usuario.entity';
import { CrearPaqueteDto } from './dto/crear-paquete.dto';
import { PaquetesService } from './paquetes.service';
import { ListarPaquetesDto } from './dto/listar-paquetes.dto';
import { ActualizarPaqueteDto } from './dto/actualizar-paquete.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('paquetes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaquetesController {
  constructor(private readonly paquetesService: PaquetesService) {}

  @Post()
  @Roles(RolUsuario.ADMIN)
  crear(@Body() datos: CrearPaqueteDto) {
    return this.paquetesService.crear(datos);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.AGENTE, RolUsuario.CLIENTE)
  listar(@Query() filtros: ListarPaquetesDto) {
    return this.paquetesService.listar(filtros);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.AGENTE, RolUsuario.CLIENTE)
  buscarPorId(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.paquetesService.buscarPorId(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  actualzar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() datos: ActualizarPaqueteDto,
  ) {
    return this.paquetesService.actualizar(id, datos);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.paquetesService.desactivar(id);
  }
}
