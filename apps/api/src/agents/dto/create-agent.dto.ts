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
} from 'class-validator';
import {
  agentStatuses,
  approvalPolicies,
  permissionPolicies,
  type AgentStatus,
  type ApprovalPolicy,
  type PermissionPolicy,
} from '../agents.types';
import { OptionalTrimmed, Trimmed } from './agent-validation';

export class CreateAgentDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(2_900_000)
  @Matches(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  avatarDataUrl?: string;

  @Trimmed()
  @IsString()
  @Length(2, 100)
  role!: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  instructions?: string;

  @IsOptional()
  @IsIn(agentStatuses)
  status?: AgentStatus;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  runtimeProvider?: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelId?: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceTier?: string;

  @OptionalTrimmed()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reasoningLevel?: string;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  monthlyBudgetCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrency?: number;

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
