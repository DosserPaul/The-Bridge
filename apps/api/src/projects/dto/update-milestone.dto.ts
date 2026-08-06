import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LinkedIssueDto } from './create-milestone.dto';

function trimNullable({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return value;
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateMilestoneDto {
  @Transform(trimNullable)
  @IsOptional()
  @IsString()
  @Length(2, 160)
  title?: string;

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
