import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates the request when a valid bearer token is present, but treats a
 * missing or invalid token as an anonymous caller instead of rejecting it.
 *
 * Used by endpoints whose response varies with the caller's identity — e.g.
 * `GET /events/:eventId`, which hides drafts from everyone except members of
 * the owning organization (#372). Anonymous callers get `request.user = null`;
 * endpoints must apply their own visibility rules to that case.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser | null {
    return err || !user ? null : user;
  }
}
