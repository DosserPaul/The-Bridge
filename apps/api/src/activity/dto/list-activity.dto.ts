import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { activityCategories, type ActivityCategory } from '../activity.types';

export class ListActivityDto {
  @IsOptional()
  @IsIn(activityCategories)
  category?: ActivityCategory;

  @IsOptional()
  @IsIn(['success', 'error'])
  status?: 'success' | 'error';

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 50 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
