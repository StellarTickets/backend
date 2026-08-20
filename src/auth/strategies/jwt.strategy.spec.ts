import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps a decoded payload to the shape guards and controllers expect', () => {
    const config = { getOrThrow: jest.fn().mockReturnValue('x'.repeat(32)) };
    const strategy = new JwtStrategy(config as unknown as ConfigService);

    const result = strategy.validate({
      sub: 'user-1',
      email: 'ada@example.com',
      role: 'ORGANIZER',
    });

    expect(result).toEqual({
      userId: 'user-1',
      email: 'ada@example.com',
      role: 'ORGANIZER',
    });
  });

  it('reads JWT_SECRET from config at construction time', () => {
    const config = { getOrThrow: jest.fn().mockReturnValue('x'.repeat(32)) };
    const strategy = new JwtStrategy(config as unknown as ConfigService);
    expect(strategy).toBeDefined();

    expect(config.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
  });
});
