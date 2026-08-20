import { IsString } from 'class-validator';

export class ConfirmPublishDto {
  /** Wallet-signed XDR envelope returned from POST /events/:id/publish, unmodified. */
  @IsString()
  signedXdr: string;
}
