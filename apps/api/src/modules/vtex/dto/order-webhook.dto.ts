import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

class OrderItemDto {
  @IsString()
  skuId!: string;

  @IsOptional()
  @IsString()
  skuRef?: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsNumber()
  listPrice?: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;
}

export class OrderWebhookDto {
  @IsString()
  orderId!: string;

  @IsIn(['order-created', 'order-paid', 'order-canceled'])
  eventType!: 'order-created' | 'order-paid' | 'order-canceled';

  @IsIn(['created', 'paid', 'invoiced', 'shipped', 'canceled', 'returned'])
  status!: 'created' | 'paid' | 'invoiced' | 'shipped' | 'canceled' | 'returned';

  @IsNumber()
  totalAmount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumber()
  shippingAmount?: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  eligibleAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  rawPayload?: unknown;
}
