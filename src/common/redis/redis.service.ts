import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.set(key, value, 'EX', ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redis.hdel(key, field);
  }

  async lpush(key: string, ...values: string[]): Promise<void> {
    await this.redis.lpush(key, ...values);
  }

  async rpop(key: string): Promise<string | null> {
    return this.redis.rpop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redis.lrange(key, start, stop);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.redis.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  async setWithIdempotency(key: string, value: string, ttl: number): Promise<boolean> {
    const result = await this.redis.setnx(key, value);
    if (result === 1) {
      await this.redis.expire(key, ttl);
      return true;
    }
    return false;
  }

  async acquireLock(key: string, ttl: number): Promise<string | null> {
    const lockId = Math.random().toString(36).substring(2, 15);
    const acquired = await this.setWithIdempotency(`lock:${key}`, lockId, ttl);
    return acquired ? lockId : null;
  }

  async releaseLock(key: string, lockId: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, `lock:${key}`, lockId);
    return result === 1;
  }

  async ping(): Promise<string> {
    return this.redis.ping();
  }
}