import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/config';
import { UnauthorizedError } from '../../../errors/auth.errors';

export interface JwtPayload {
  sub: string;
  email: string;
  locationId: string;
  type: 'access';
}

export interface AuthUser {
  userId: string;
  email: string;
  locationId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const config = configService.get<AppConfig>('app')!;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => request?.cookies?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.JWT_SECRET,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (payload.type !== 'access') throw new UnauthorizedError();
    return {
      userId: payload.sub,
      email: payload.email,
      locationId: payload.locationId,
    };
  }
}
