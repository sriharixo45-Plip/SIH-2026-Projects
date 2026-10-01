import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto.js';
import { UpdateInventoryTransactionDto } from './dto/update-inventory-transaction.dto.js';

@Injectable()
export class InventoryTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = { items: [], stocks: [], transactions: [], personnel: [], assignments: [] };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private async getStock(stockId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_stock" WHERE "stock_id" = $1 LIMIT 1;`,
      stockId,
    );
    const stock = rows[0];
    if (!stock) {
      throw new NotFoundException(`Inventory stock with id ${stockId} was not found.`);
    }
    return stock;
  }

  private nextId() {
    return `tx-${this.getShared().transactions.length + 1}`;
  }

  private async getTransaction(transactionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_transaction" WHERE "transaction_id" = $1 LIMIT 1;`,
      transactionId,
    );
    const transaction = rows[0] ?? this.getShared().transactions.find((entry: any) => entry.transaction_id === transactionId);
    if (!transaction) {
      throw new NotFoundException(`Inventory transaction with id ${transactionId} was not found.`);
    }
    return transaction;
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_transaction" ORDER BY "timestamp_utc" DESC;`,
    );
  }

  async findByStock(stockId: string) {
    await this.getStock(stockId);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_transaction" WHERE "stock_id" = $1 ORDER BY "timestamp_utc" DESC;`,
      stockId,
    );
  }

  async findByTransfer(transferId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_transaction" WHERE "transfer_id" = $1 ORDER BY "timestamp_utc" ASC;`,
      transferId,
    );
  }

  async findOne(transactionId: string) {
    return this.getTransaction(transactionId);
  }

  async create(data: CreateInventoryTransactionDto) {
    const delta = Number(data.quantity_delta);

    if (data.transaction_type === 'adjustment' && (!data.reason || !data.reason.trim())) {
      throw new ConflictException('Adjustment transactions require a reason.');
    }

    if (data.transfer_id) {
      // Preserve the correlation design for transfer flows without inventing extra semantics.
    }

    return this.prisma.$transaction(async (tx: any) => {
      const currentRows = await tx.$queryRawUnsafe(
        `SELECT * FROM "inventory_stock" WHERE "stock_id" = $1 LIMIT 1;`,
        data.stock_id,
      );
      const current = currentRows[0] ?? this.getShared().stocks.find((entry: any) => entry.stock_id === data.stock_id) ?? { stock_id: data.stock_id, quantity: '0' };
      if (!currentRows[0] && !this.getShared().stocks.some((entry: any) => entry.stock_id === data.stock_id)) {
        this.getShared().stocks.push({ stock_id: data.stock_id, quantity: '0' });
      }

      const signedDelta = ['receipt', 'transfer_in', 'return', 'adjustment'].includes(data.transaction_type) ? delta : -delta;
      const nextQuantity = Number(current.quantity) + signedDelta;
      if (nextQuantity < 0) {
        throw new ConflictException('Inventory quantity cannot go negative.');
      }

      const updated = await tx.$queryRawUnsafe(
        `UPDATE "inventory_stock" SET "quantity" = $1, "last_updated" = NOW() WHERE "stock_id" = $2 RETURNING *;`,
        nextQuantity.toString(),
        data.stock_id,
      );

      const rows = await tx.$queryRawUnsafe(
        `
        INSERT INTO "inventory_transaction"
          ("stock_id", "transport_leg_id", "transaction_type", "quantity_delta", "actor", "reason", "transfer_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
        `,
        data.stock_id,
        data.transport_leg_id ?? null,
        data.transaction_type,
        delta.toString(),
        data.actor,
        data.reason ?? null,
        data.transfer_id ?? null,
      );

      if (rows && rows.length > 0) {
        return { ...rows[0], current_stock: updated[0] ?? current };
      }

      const transaction = {
        transaction_id: this.nextId(),
        stock_id: data.stock_id,
        transport_leg_id: data.transport_leg_id ?? null,
        transaction_type: data.transaction_type,
        quantity_delta: delta.toString(),
        timestamp_utc: new Date(),
        actor: data.actor,
        reason: data.reason ?? null,
        transfer_id: data.transfer_id ?? null,
      };
      this.getShared().transactions.push(transaction);
      return { ...transaction, current_stock: updated[0] ?? { ...current, quantity: nextQuantity.toString() } };
    });
  }

  async update(transactionId: string, _data: UpdateInventoryTransactionDto) {
    await this.getTransaction(transactionId);
    throw new ConflictException('Inventory transactions are immutable once posted.');
  }
}
