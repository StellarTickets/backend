import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function mockContext(user: { role: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request through when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(mockContext(undefined))).toBe(true);
  });

  it('rejects an unauthenticated request when roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ORGANIZER']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a user whose role is not in the required list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ORGANIZER']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(mockContext({ role: 'ATTENDEE' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a user whose role matches', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ORGANIZER']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(mockContext({ role: 'ORGANIZER' }))).toBe(true);
  });
});
