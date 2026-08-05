import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CreateClientContactDto } from './create-client-contact.dto';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export class CreateClientDto {
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsIn(['organization', 'individual'])
  kind!: 'organization' | 'individual';

  @IsIn(['active', 'prospect', 'paused'])
  status!: 'active' | 'prospect' | 'paused';

  @Transform(trimOptionalString)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_900_000)
  @Matches(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  logoDataUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientContactDto)
  primaryContact?: CreateClientContactDto;
}
