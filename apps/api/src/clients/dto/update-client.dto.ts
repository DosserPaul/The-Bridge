import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CreateClientContactDto } from './create-client-contact.dto';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimNullableString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || null;
}

export class UpdateClientDto {
  @Transform(trimString)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(2, 120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['organization', 'individual'])
  kind?: 'organization' | 'individual';

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['active', 'prospect', 'paused'])
  status?: 'active' | 'prospect' | 'paused';

  @Transform(trimNullableString)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2_900_000)
  @Matches(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  logoDataUrl?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @ValidateNested()
  @Type(() => CreateClientContactDto)
  primaryContact?: CreateClientContactDto | null;
}
