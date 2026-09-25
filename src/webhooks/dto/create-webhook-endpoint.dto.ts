import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateWebhookEndpointDto {
  @IsString()
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
      require_tld: false,
    },
    { message: 'url must be a valid http or https URL' },
  )
  url!: string;

  @IsOptional()
  @IsString()
  events?: string;

  @IsOptional()
  @IsString()
  secret?: string;
}
