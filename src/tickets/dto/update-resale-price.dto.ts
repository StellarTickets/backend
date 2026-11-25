import { IsBigIntString } from '../../common/decorators/is-bigint-string.decorator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

export class UpdateResalePriceDto {
  /** Updated asking price in settlement token smallest units. */
  @IsBigIntString()
  price!: string;
}

/** #502 — the signed `list_for_resale` re-listing at `price`. */
export class ConfirmUpdateResalePriceDto extends ConfirmSignedTxDto {
  /** Updated asking price; must match the price in `signedXdr`. */
  @IsBigIntString()
  price!: string;
}
