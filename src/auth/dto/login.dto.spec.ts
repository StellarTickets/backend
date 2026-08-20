import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a well-formed payload', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'ada@example.com',
      password: 'anything',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed email', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'nope',
      password: 'anything',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a non-string password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'ada@example.com',
      password: 12345,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
