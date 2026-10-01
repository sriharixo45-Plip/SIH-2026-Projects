import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'test') return 'test-only-polaris-jwt-secret-not-for-deployment';
    throw new Error('FATAL: JWT_SECRET environment variable is required.');
  }
  if (secret.length < 32) throw new Error('FATAL: JWT_SECRET must contain at least 32 characters.');
  return secret;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto) {
    const now = new Date();
    const user = await this.prisma.user.findFirst({
      where: { deleted_at: null, OR: [{ employee_code: dto.identity ?? dto.employee_code ?? '' }, { email: dto.identity ?? dto.email ?? '' }] },
      include: {
        credential: true,
        role_assignments: {
          where: { valid_from: { lte: now }, OR: [{ valid_to: null }, { valid_to: { gt: now } }] },
          include: {
            role: true,
            station: true,
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials or user is inactive');
    }

    if (!user.credential || !user.credential.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.credential.password_hash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { user_id: user.user_id },
      data: { last_login_at: new Date() },
    });

    const primaryAssignment = user.role_assignments.find((r) => r.is_primary) || user.role_assignments[0];
    const roleName = primaryAssignment?.role?.name || 'Field Officer';
    const stationCode = primaryAssignment?.station?.code || null;

    const secret = getJwtSecret();

    const accessToken = jwt.sign(
      {
        sub: user.user_id,
        employee_code: user.employee_code,
        role: roleName,
        station_id: primaryAssignment?.station_id || null,
        type: 'access',
      },
      secret,
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      {
        sub: user.user_id,
        type: 'refresh',
        jti: randomUUID(),
      },
      secret,
      { expiresIn: '7d' },
    );
    const refreshClaims = jwt.decode(refreshToken) as jwt.JwtPayload;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "user_refresh_session" ("user_id", "token_hash", "expires_at") VALUES ($1::uuid, $2, $3);`,
      user.user_id, hashToken(refreshToken), new Date((refreshClaims.exp ?? 0) * 1000),
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        user_id: user.user_id,
        employee_code: user.employee_code,
        full_name: user.full_name,
        email: user.email,
        role: roleName,
        station_code: stationCode,
        station_id: primaryAssignment?.station_id || null,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    if (!dto.refresh_token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const secret = getJwtSecret();

    try {
      const decoded = jwt.verify(dto.refresh_token, secret) as any;
      if (decoded.type !== 'refresh' || !decoded.sub || !decoded.jti) {
        throw new UnauthorizedException('Invalid refresh token type');
      }
      const sessions = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "session_id" FROM "user_refresh_session" WHERE "token_hash" = $1 AND "revoked_at" IS NULL AND "expires_at" > NOW() LIMIT 1;`, hashToken(dto.refresh_token));
      if (!sessions.length) throw new UnauthorizedException('Refresh token was already used or revoked.');

      const now = new Date();
      const user = await this.prisma.user.findUnique({
        where: { user_id: decoded.sub },
        include: {
          role_assignments: {
            where: { valid_from: { lte: now }, OR: [{ valid_to: null }, { valid_to: { gt: now } }] },
            include: {
              role: true,
              station: true,
            },
          },
        },
      });

      if (!user || user.status !== 'active' || user.deleted_at) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const primaryAssignment = user.role_assignments.find((r) => r.is_primary) || user.role_assignments[0];
      const roleName = primaryAssignment?.role?.name || 'Field Officer';

      const newAccessToken = jwt.sign(
        {
          sub: user.user_id,
          employee_code: user.employee_code,
          role: roleName,
          station_id: primaryAssignment?.station_id || null,
          type: 'access',
        },
        secret,
        { expiresIn: '15m' },
      );

      const newRefreshToken = jwt.sign(
        {
          sub: user.user_id,
          type: 'refresh',
          jti: randomUUID(),
        },
        secret,
        { expiresIn: '7d' },
      );
      const refreshClaims = jwt.decode(newRefreshToken) as jwt.JwtPayload;
      await this.prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe(`UPDATE "user_refresh_session" SET "revoked_at" = NOW() WHERE "token_hash" = $1 AND "revoked_at" IS NULL;`, hashToken(dto.refresh_token));
        await tx.$executeRawUnsafe(`INSERT INTO "user_refresh_session" ("user_id", "token_hash", "expires_at") VALUES ($1::uuid, $2, $3);`, user.user_id, hashToken(newRefreshToken), new Date((refreshClaims.exp ?? 0) * 1000));
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getMe(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const secret = getJwtSecret();
    let decoded: any;

    try {
      decoded = jwt.verify(token, secret);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (!decoded || !decoded.sub || decoded.type !== 'access') {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { user_id: decoded.sub },
      include: {
        role_assignments: {
          where: { valid_from: { lte: now }, OR: [{ valid_to: null }, { valid_to: { gt: now } }] },
          include: {
            role: true,
            station: true,
          },
        },
      },
    });

    if (!user || user.status !== 'active' || user.deleted_at) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const primaryAssignment = user.role_assignments.find((r) => r.is_primary) || user.role_assignments[0];

    return {
      user_id: user.user_id,
      employee_code: user.employee_code,
      full_name: user.full_name,
      email: user.email,
      role: primaryAssignment?.role?.name || null,
      scope: primaryAssignment?.station?.name || null,
      station_code: primaryAssignment?.station?.code || null,
      station_id: primaryAssignment?.station_id || null,
      roles: user.role_assignments.map((ra) => ({
        role_id: ra.role_id,
        role_name: ra.role.name,
        station_id: ra.station_id,
      })),
    };
  }

  async logout(userId: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE "user_refresh_session" SET "revoked_at" = NOW() WHERE "user_id" = $1::uuid AND "revoked_at" IS NULL;`, userId);
    return { message: 'Logged out successfully' };
  }
}
