import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProjectDocumentDto {
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  repositoryId?: string | null;

  @IsIn(['file', 'link'])
  kind!: 'file' | 'link';

  @IsIn(['readme', 'specification', 'contract', 'technical', 'design', 'other'])
  category!:
    'readme' | 'specification' | 'contract' | 'technical' | 'design' | 'other';

  @Transform(trim)
  @IsString()
  @Length(2, 160)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 2_000)
  location!: string;

  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2_000)
  description?: string | null;
}

export class UpdateProjectDocumentDto {
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  repositoryId?: string | null;

  @IsOptional()
  @IsIn(['file', 'link'])
  kind?: 'file' | 'link';

  @IsOptional()
  @IsIn(['readme', 'specification', 'contract', 'technical', 'design', 'other'])
  category?:
    'readme' | 'specification' | 'contract' | 'technical' | 'design' | 'other';

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 160)
  title?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  location?: string;

  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2_000)
  description?: string | null;
}

export class PreviewProjectDocumentDto {
  @IsUUID('4')
  repositoryId!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 2_000)
  path!: string;
}
