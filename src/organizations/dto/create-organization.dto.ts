import { IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { Industry } from '@prisma/client';
import { IsStellarPublicKey } from '../../common/decorators/is-stellar-public-key.decorator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, alphanumeric, and hyphen-separated',
  })
  slug: string;

  @IsEnum(Industry)
  industry: Industry;

  @IsStellarPublicKey()
  stellarAccount: string;
}
