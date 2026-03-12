import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
  ValidateNested,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { OrderSource, OrderStatus } from '@orderhub/types';
import { LIMITS } from '../../../constants/limits';

export class ImportedOrderItemDto {
  @IsString() externalId: string;
  @IsString() name: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
  @IsNumber() @Min(0) totalPrice: number;
  @IsOptional() @IsString() notes?: string;
}

export class ImportedOrderDto {
  @IsString() externalId: string;
  @IsEnum(OrderSource) source: OrderSource;
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsString() customerName: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() customerAddress?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportedOrderItemDto)
  items: ImportedOrderItemDto[];

  @IsNumber() @Min(0) subtotal: number;
  @IsNumber() @Min(0) discounts: number;
  @IsNumber() @Min(0) deliveryFee: number;
  @IsNumber() @Min(0) total: number;
  @IsOptional() @IsString() notes?: string;
  @IsDateString() placedAt: string;
  @IsOptional() @IsObject() rawPayload?: Record<string, unknown>;
}

export class ImportOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.orders.importBatchSize)
  @ValidateNested({ each: true })
  @Type(() => ImportedOrderDto)
  orders: ImportedOrderDto[];
}
