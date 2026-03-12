import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './strategies/jwt.strategy';
import { TokenInvalidError } from '../../errors/auth.errors';

const ACCESS_TOKEN_TTL = 15 * 60;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { user, tokens } = await this.authService.register(dto);
    this.setTokenCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { user, tokens } = await this.authService.login(dto);
    this.setTokenCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) throw new TokenInvalidError();
    const { tokens } = await this.authService.refresh(refreshToken);
    this.setTokenCookies(reply, tokens.accessToken, tokens.refreshToken);
    return {};
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const refreshToken = request.cookies?.refresh_token;
    await this.authService.logout(refreshToken);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });
    return {};
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  private setTokenCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
    reply.setCookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL,
    });
    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL,
    });
  }
}
