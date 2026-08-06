import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import type { TodayFocusPriority } from '../today.types';

function trimNullable({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return value;
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateFocusItemDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @IsOptional()
  @IsIn(['critical', 'high', 'normal'])
  priority?: TodayFocusPriority;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;
}
