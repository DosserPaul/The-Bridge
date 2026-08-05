import { Transform } from 'class-transformer';
import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ConnectGitLabDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  baseUrl!: string;

  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  token!: string;
}
