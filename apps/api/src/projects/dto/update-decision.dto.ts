import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

function trimNullable({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return value;
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateDecisionDto {
  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @Length(2, 160)
  title?: string;

  @IsOptional()
  @IsIn(['proposed', 'accepted', 'rejected', 'superseded'])
  status?: 'proposed' | 'accepted' | 'rejected' | 'superseded';

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @Length(2, 10_000)
  context?: string;

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @Length(2, 10_000)
  decision?: string;

  @Transform(trimNullable)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10_000)
  rationale?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 1_000, { each: true })
  alternatives?: string[];

  @Transform(trimNullable)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10_000)
  consequences?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  participants?: string[];

  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  decidedAt?: string;
}
