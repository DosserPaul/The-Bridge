import { IsOptional, IsUUID } from 'class-validator';

export class AssociateRepositoryConnectionDto {
  @IsOptional()
  @IsUUID('4')
  connectionId!: string | null;
}
