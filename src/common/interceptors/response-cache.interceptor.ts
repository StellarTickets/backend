import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHE_STORE } from '../cache/cache-store';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';

interface CacheStore {
  get<T>(k: string): Promise<T | undefined>;
  set(k: string, v: unknown, ttl: number): Promise<void>;
  delete(k: string): Promise<void>;
}

@Injectable()
export class ResponseCacheInterceptor implements NestInterceptor {
  private readonly defaultTtlMs: number;

  constructor(
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
    private readonly config: ConfigService,
  ) {
    this.defaultTtlMs = config.get<number>('CACHE_TTL_SECONDS', 60) * 1000;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET') {
      return next.handle();
    }
    // #372 — some GET routes return a body that depends on the caller (e.g.
    // an event detail hides drafts from non-members), so an authenticated
    // request must never share a cache entry with anonymous callers.
    const userId = (req as Request & { user?: { userId?: string } }).user
      ?.userId;
    const key = userId ? `cache:user:${userId}:${req.url}` : `cache:${req.url}`;
    const cached = await this.cache.get<unknown>(key);
    if (cached !== undefined) {
      return of(cached);
    }
    return next.handle().pipe(
      tap({
        next: (data: unknown) => {
          void this.cache.set(key, data, this.defaultTtlMs);
        },
      }),
    );
  }

  invalidate(pattern: string): Promise<void> {
    return this.cache.delete(pattern);
  }
}
