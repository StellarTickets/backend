import { validate } from 'class-validator';
import { IsSignedXdr, SIGNED_XDR_MAX_LENGTH } from './is-signed-xdr.decorator';

class TestDto {
  @IsSignedXdr()
  signedXdr!: string;
}

describe('IsSignedXdr', () => {
  it('accepts well-formed base64', async () => {
    const dto = new TestDto();
    dto.signedXdr = Buffer.from('a fake but well-formed envelope').toString(
      'base64',
    );

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty string', async () => {
    const dto = new TestDto();
    dto.signedXdr = '';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isSignedXdr');
  });

  it('rejects a string that is not base64', async () => {
    const dto = new TestDto();
    dto.signedXdr = 'not valid base64!!! {}';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isSignedXdr');
  });

  it('rejects a payload over the size cap', async () => {
    const dto = new TestDto();
    dto.signedXdr = Buffer.from('a'.repeat(SIGNED_XDR_MAX_LENGTH)).toString(
      'base64',
    );

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isSignedXdr');
  });
});
