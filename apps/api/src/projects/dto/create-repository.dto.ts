import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
}

export class CreateRepositoryDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 1024)
  repositoryPath!: string;

  @IsOptional()
  @IsIn(['local', 'existing', 'create'])
  repositoryMode?: 'local' | 'existing' | 'create';

  @IsOptional()
  @IsIn(['github', 'gitlab'])
  provider?: 'github' | 'gitlab';

  @IsOptional()
  @IsUUID('4')
  connectionId?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remoteRepositoryId?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Za-z0-9._-]+$/)
  remoteRepositoryName?: string;

  @IsOptional()
  @IsIn(['private', 'public'])
  repositoryVisibility?: 'private' | 'public';

  @IsOptional()
  @IsBoolean()
  initializeReadme?: boolean;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
