import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  agentStatuses,
  approvalPolicies,
  permissionPolicies,
  type AgentStatus,
  type ApprovalPolicy,
  type PermissionPolicy,
} from '../agents.types';
import { OptionalTrimmed } from './agent-validation';

export class UpdateAgentDto {
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

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2_900_000)
  @Matches(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  avatarDataUrl?: string | null;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @Length(2, 100)
  role?: string;

  @OptionalTrimmed()
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2_000)
  description?: string | null;

  @OptionalTrimmed()
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(20_000)
  instructions?: string | null;

  @IsOptional()
  @IsIn(agentStatuses)
  status?: AgentStatus;

  @OptionalTrimmed()
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(100)
  runtimeProvider?: string | null;

  @OptionalTrimmed()
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(200)
  modelId?: string | null;

  @OptionalTrimmed()
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(100)
  serviceTier?: string | null;

  @OptionalTrimmed()
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(100)
  reasoningLevel?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  capabilities?: string[];

  @IsOptional()
  @IsIn(permissionPolicies)
  permissionPolicy?: PermissionPolicy;

  @IsOptional()
  @IsIn(approvalPolicies)
  approvalPolicy?: ApprovalPolicy;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  monthlyBudgetCents?: number | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrency?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  projectIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  repositoryIds?: string[];
}
