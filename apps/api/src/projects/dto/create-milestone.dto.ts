import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

function trimNullable({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return value;
  return typeof value === 'string' ? value.trim() : value;
}

export class LinkedIssueDto {
  @IsUUID('4')
  repositoryId!: string;

  @Transform(trimNullable)
  @IsString()
  @Length(1, 160)
  repositoryName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  number!: number;

  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  title!: string;

  @Transform(trimNullable)
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2_000)
  webUrl!: string;
}

export class CreateMilestoneDto {
  @Transform(trimNullable)
  @IsString()
  @Length(2, 160)
  title!: string;

  @Transform(trimNullable)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(5_000)
  description?: string | null;

  @IsOptional()
  @IsIn(['planned', 'active', 'completed', 'canceled'])
  status?: 'planned' | 'active' | 'completed' | 'canceled';

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10)
  dueDate?: string | null;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  riskLevel?: 'low' | 'medium' | 'high';

  @Transform(trimNullable)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(5_000)
  blockers?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LinkedIssueDto)
  linkedIssues?: LinkedIssueDto[];
}
