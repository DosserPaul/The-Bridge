import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
  const trimmed = value.trim();
  return trimmed || undefined;
}

const projectTypes = [
  'web',
  'mobile',
  'backend',
  'ai',
  'desktop',
  'data',
  'automation',
  'infrastructure',
  'other',
] as const;

export class CreateProjectDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_900_000)
  @Matches(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  logoDataUrl?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['planned', 'active', 'paused', 'completed', 'archived'])
  status?: 'planned' | 'active' | 'paused' | 'completed' | 'archived';

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: 'low' | 'normal' | 'high' | 'critical';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsIn(projectTypes, { each: true })
  types?: (typeof projectTypes)[number][];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  technologies?: string[];

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  deadline?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  followUpDate?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  followUpNote?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Length(2, 120)
  clientName?: string;

  @IsOptional()
  @IsUUID('4')
  clientId?: string;

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
}
