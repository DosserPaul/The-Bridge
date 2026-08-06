import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { agentTeamStatuses, type AgentTeamStatus } from '../agents.types';
import { OptionalTrimmed } from './agent-validation';

export class UpdateAgentTeamDto {
  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @OptionalTrimmed()
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2_000)
  description?: string | null;

  @IsOptional()
  @IsIn(agentTeamStatuses)
  status?: AgentTeamStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
