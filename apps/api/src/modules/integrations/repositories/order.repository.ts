import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Order } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';

// Tipo temporal hasta que el DTO esté creado
interface ImportedOrderData {
  externalId: string;
  source: string;
  status: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  subtotal: number;
  discounts: number;
  deliveryFee: number;
  total: number;
  notes?: string;
  placedAt: string;
  rawPayload?: Record<string, unknown>;
  items: Array<{
    externalId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }>;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(
    locationId: string,
    source: string,
    externalId: string,
  ): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: {
        locationId_source_externalId: { locationId, source, externalId },
      },
    });
  }

  async create(locationId: string, order: ImportedOrderData): Promise<Order> {
    return this.prisma.order.create({
      data: {
        locationId,
        externalId: order.externalId,
        source: order.source,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone ?? null,
        customerAddress: order.customerAddress ?? null,
        subtotal: order.subtotal,
        discounts: order.discounts,
        deliveryFee: order.deliveryFee,
        total: order.total,
        notes: order.notes ?? null,
        placedAt: new Date(order.placedAt),
        rawPayload: (order.rawPayload as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        items: {
          create: order.items.map((item) => ({
            externalId: item.externalId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes ?? null,
          })),
        },
      },
    });
  }
}
