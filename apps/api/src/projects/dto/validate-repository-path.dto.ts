import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export class ValidateRepositoryPathDto {
  @IsIn(['local', 'existing', 'create'])
  repositoryMode!: 'local' | 'existing' | 'create';

  @Transform(trimString)
  @IsString()
  @Length(1, 1024)
  repositoryPath!: string;

  @IsOptional()
  @IsIn(['exact', 'subfolder'])
  cloneDestinationMode?: 'exact' | 'subfolder';

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @IsNotIn(['.', '..'])
  @Matches(/^[A-Za-z0-9._-]+$/)
  cloneDirectoryName?: string;
}
