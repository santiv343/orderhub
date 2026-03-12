import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UnauthorizedError } from '../../../errors/auth.errors';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) throw new UnauthorizedError();
    return user;
  }
}
