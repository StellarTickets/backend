import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

describe('ConfirmSignedTxDto', () => {
  it('accepts a string signedXdr', async () => {
    const dto = plainToInstance(ConfirmSignedTxDto, {
      signedXdr: 'AAAAAgAAAAA=',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing signedXdr', async () => {
    const dto = plainToInstance(ConfirmSignedTxDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'signedXdr')).toBe(true);
  });
});
