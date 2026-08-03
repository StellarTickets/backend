import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConnectWalletDto } from './connect-wallet.dto';

describe('ConnectWalletDto', () => {
  it('accepts a valid Stellar public key', async () => {
    const dto = plainToInstance(ConnectWalletDto, {
      stellarPublicKey:
        'GBAHZWO3UI3GAHPQCPSW6IR5N7HJ4UBRZNAFMSYB6DAKVNHQDOZIV2YJ',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed public key', async () => {
    const dto = plainToInstance(ConnectWalletDto, {
      stellarPublicKey: 'not-a-key',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'stellarPublicKey')).toBe(true);
  });
});
