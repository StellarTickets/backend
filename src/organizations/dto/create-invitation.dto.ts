import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { OrgMemberRole } from '@prisma/client';

/** Roles an invite can grant. Ownership is not transferable by invite. */
export const INVITABLE_ROLES = [OrgMemberRole.ADMIN, OrgMemberRole.STAFF];

export class CreateInvitationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(INVITABLE_ROLES)
  role?: OrgMemberRole;
}
