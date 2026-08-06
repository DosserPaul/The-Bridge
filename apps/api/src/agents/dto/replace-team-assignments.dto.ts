import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trimmed } from './agent-validation';

export class AgentAssignmentInputDto {
  @IsUUID('4')
  agentId!: string;

  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsUUID('4')
  parentAgentId?: string | null;

  @Trimmed()
  @IsString()
  @Length(2, 100)
  role!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class ReplaceTeamAssignmentsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AgentAssignmentInputDto)
  assignments!: AgentAssignmentInputDto[];
}
