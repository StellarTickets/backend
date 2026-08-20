import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmPublishDto } from './confirm-publish.dto';

describe('ConfirmPublishDto', () => {
  it('accepts a string signedXdr', async () => {
    const dto = plainToInstance(ConfirmPublishDto, {
      signedXdr: 'AAAAAgAAAAA=',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing signedXdr', async () => {
    const dto = plainToInstance(ConfirmPublishDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'signedXdr')).toBe(true);
  });
});
