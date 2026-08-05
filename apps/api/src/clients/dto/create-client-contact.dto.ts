import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export class CreateClientContactDto {
  @Transform(trimOptionalString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

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
}
