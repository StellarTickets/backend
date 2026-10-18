import { validate } from 'class-validator';
import {
  encodeMuxedAccount,
  encodeMuxedAccountToAddress,
} from '@stellar/stellar-sdk';
import { IsStellarPublicKey } from './is-stellar-public-key.decorator';

const VALID_PUBLIC_KEY =
  'GBAHZWO3UI3GAHPQCPSW6IR5N7HJ4UBRZNAFMSYB6DAKVNHQDOZIV2YJ';

class TestDto {
  @IsStellarPublicKey()
  stellarAccount!: string;
}

describe('IsStellarPublicKey', () => {
  it('accepts a valid ed25519 Stellar public key', async () => {
    const dto = new TestDto();
    dto.stellarAccount = VALID_PUBLIC_KEY;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a public-key-shaped string with an invalid checksum', async () => {
    const dto = new TestDto();
    dto.stellarAccount = `${VALID_PUBLIC_KEY.slice(0, -1)}X`;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isStellarPublicKey');
  });

  it('rejects muxed M... addresses because this validator accepts only G... keys', async () => {
    const dto = new TestDto();
    dto.stellarAccount = encodeMuxedAccountToAddress(
      encodeMuxedAccount(VALID_PUBLIC_KEY, '1'),
    );

    expect(dto.stellarAccount).toMatch(/^M/);
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isStellarPublicKey');
  });

  it('rejects a string that is not a valid public key', async () => {
    const dto = new TestDto();
    dto.stellarAccount = 'not-a-real-address';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isStellarPublicKey');
  });

  it('rejects a secret key (S...) passed where a public key belongs', async () => {
    const dto = new TestDto();
    dto.stellarAccount =
      'SA4IGCSRIDQ3L4274BRKUGPMVCDB4A6IHFKRGMHLLZ7TPOIC4TEEI6QX';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
