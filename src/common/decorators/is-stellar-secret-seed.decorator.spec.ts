import { validate } from 'class-validator';
import { IsStellarSecretSeed } from './is-stellar-secret-seed.decorator';

class TestDto {
  @IsStellarSecretSeed()
  secret!: string;
}

describe('IsStellarSecretSeed', () => {
  it('accepts a valid ed25519 secret seed', async () => {
    const dto = new TestDto();
    dto.secret = 'SA4IGCSRIDQ3L4274BRKUGPMVCDB4A6IHFKRGMHLLZ7TPOIC4TEEI6QX';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a string that is not a valid secret seed', async () => {
    const dto = new TestDto();
    dto.secret = 'not-a-real-secret';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isStellarSecretSeed');
  });

  it('rejects a public key (G...) passed where a secret seed belongs', async () => {
    const dto = new TestDto();
    dto.secret = 'GBAHZWO3UI3GAHPQCPSW6IR5N7HJ4UBRZNAFMSYB6DAKVNHQDOZIV2YJ';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
