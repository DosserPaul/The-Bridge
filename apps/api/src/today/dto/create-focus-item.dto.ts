import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import type { TodayFocusPriority } from '../today.types';

function trimNullable({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return value;
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateFocusItemDto {
  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceKey?: string;

  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @Transform(trimNullable)
  @IsString()
  @Length(2, 200)
  title!: string;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  href?: string;

  @IsOptional()
  @IsIn(['critical', 'high', 'normal'])
  priority?: TodayFocusPriority;
}
