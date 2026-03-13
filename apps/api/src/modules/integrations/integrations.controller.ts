import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IntegrationsService } from './integrations.service';
import { ImportOrdersDto } from './dto/import-orders.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

@Controller('integrations')
@SkipThrottle()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('orders/import')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async importOrders(
    @Body() dto: ImportOrdersDto,
    @Req() request: { locationId: string },
  ) {
    return this.integrationsService.importOrders(request.locationId, dto);
  }
}
