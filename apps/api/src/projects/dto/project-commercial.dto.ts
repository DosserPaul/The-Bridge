import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProjectFinanceDto {
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  dailyRateCents?: number | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  budgetCents?: number | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10)
  nextInvoiceDate?: string | null;
}

export class CreateTimeEntryDto {
  @IsString()
  @MaxLength(10)
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationMinutes!: number;

  @Transform(trim)
  @IsString()
  @Length(2, 500)
  description!: string;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationMinutes?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
