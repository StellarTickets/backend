import { IsString } from 'class-validator';

/** Base shape for every "confirm" endpoint that relays a wallet-signed XDR envelope. */
export class ConfirmSignedTxDto {
  @IsString()
  signedXdr: string;
}
