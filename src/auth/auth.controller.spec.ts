import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { register: jest.Mock; login: jest.Mock };

  beforeEach(() => {
    authService = { register: jest.fn(), login: jest.fn() };
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('delegates register to AuthService.register', async () => {
    authService.register.mockResolvedValue({ accessToken: 'token' });
    const dto = {
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      name: 'Ada',
    };

    const result = await controller.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ accessToken: 'token' });
  });

  it('delegates login to AuthService.login', async () => {
    authService.login.mockResolvedValue({ accessToken: 'token' });
    const dto = { email: 'ada@example.com', password: 'correct-horse-battery' };

    const result = await controller.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ accessToken: 'token' });
  });
});
