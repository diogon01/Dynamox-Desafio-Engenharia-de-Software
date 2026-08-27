import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService, type PublicUser } from './auth.service';
import type { JwtPayload } from './jwt-auth.guard';
import { Public } from './public.decorator';

interface LoginDto {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function parseLoginDto(body: unknown): LoginDto {
  const dto = (body ?? {}) as Partial<LoginDto>;
  if (
    typeof dto.email !== 'string' ||
    typeof dto.password !== 'string' ||
    dto.password === '' ||
    dto.password.length > 256 ||
    !EMAIL_PATTERN.test(dto.email.trim())
  ) {
    throw new BadRequestException({
      code: 'INVALID_CREDENTIALS_PAYLOAD',
      message: 'Informe um e-mail válido e uma senha não vazia.',
    });
  }
  return { email: dto.email.trim(), password: dto.password };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: unknown): Promise<{ token: string; user: PublicUser }> {
    const { email, password } = parseLoginDto(body);
    return this.auth.login(email, password);
  }

  @Get('me')
  me(@Req() request: Request & { user: JwtPayload }): Promise<PublicUser> {
    return this.auth.me(request.user.sub);
  }
}
