import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    // Skip if no idempotency key provided
    if (!idempotencyKey) {
      return next.handle();
    }

    // Check if we've already processed this request
    const cacheKey = `idempotency:${idempotencyKey}`;
    const cachedResponse = await this.redisService.get(cacheKey);

    if (cachedResponse) {
      // Return cached response
      const response = JSON.parse(cachedResponse);
      return of(response);
    }

    // Lock to prevent concurrent processing
    const lockKey = `${cacheKey}:lock`;
    const lockId = await this.redisService.acquireLock(lockKey, 30);

    if (!lockId) {
      throw new HttpException(
        'Request is already being processed',
        HttpStatus.CONFLICT,
      );
    }

    try {
      return next.handle().pipe(
        tap(async (response) => {
          // Cache the response
          await this.redisService.set(
            cacheKey,
            JSON.stringify(response),
            86400, // 24 hours TTL
          );
          // Release the lock
          await this.redisService.releaseLock(lockKey, lockId);
        }),
      );
    } catch (error) {
      // Release lock on error
      await this.redisService.releaseLock(lockKey, lockId);
      throw error;
    }
  }
}