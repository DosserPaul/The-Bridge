import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { OptionalTrimmed, Trimmed } from './agent-validation';

export class CreateAgentTeamDto {
  @Trimmed()
  @IsString()
  @Length(2, 80)
  name!: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
