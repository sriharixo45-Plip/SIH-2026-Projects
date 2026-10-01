import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, getJwtSecret } from './auth.service.js';
import { PrismaService } from '../prisma.service.js';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: any;

  const mockActiveUser = {
    user_id: 'usr-101-uuid',
    employee_code: 'EMP-001',
    full_name: 'Admin User',
    email: 'admin@polaris.org',
    status: 'active',
    credential: {
      password_hash: '',
    },
    role_assignments: [
      {
        is_primary: true,
        station_id: 'stn-01-uuid',
        role: { name: 'Station Leader' },
        station: { code: 'BRH' },
      },
    ],
  };

  beforeEach(async () => {
    mockActiveUser.credential.password_hash = await argon2.hash('password123', { type: argon2.argon2id });

    prismaService = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ session_id: 'session-1' }]),
      $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback({ $executeRawUnsafe: vi.fn().mockResolvedValue(1) })),
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('a. valid credentials login & JWT issuance', async () => {
    prismaService.user.findFirst.mockResolvedValue(mockActiveUser);

    const result = await authService.login({
      employee_code: 'EMP-001',
      password: 'password123',
    });

    expect(result).toBeDefined();
    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
    expect(result.user.employee_code).toBe('EMP-001');
    const assignmentFilter = prismaService.user.findFirst.mock.calls[0][0].include.role_assignments.where;
    expect(assignmentFilter.valid_from.lte).toBeInstanceOf(Date);
    expect(assignmentFilter.OR).toEqual([
      { valid_to: null },
      { valid_to: { gt: assignmentFilter.valid_from.lte } },
    ]);

    const secret = getJwtSecret();
    const decoded = jwt.verify(result.access_token, secret) as any;
    expect(decoded.sub).toBe('usr-101-uuid');
    expect(decoded.type).toBe('access');
  });

  it('b. wrong password -> 401 Unauthorized', async () => {
    prismaService.user.findFirst.mockResolvedValue(mockActiveUser);

    await expect(
      authService.login({
        employee_code: 'EMP-001',
        password: 'wrong_password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('c. inactive user -> 401 Unauthorized', async () => {
    const inactiveUser = { ...mockActiveUser, status: 'inactive' };
    prismaService.user.findFirst.mockResolvedValue(inactiveUser);

    await expect(
      authService.login({
        employee_code: 'EMP-001',
        password: 'password123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('d. missing token on getMe -> 401 Unauthorized', async () => {
    await expect(authService.getMe(undefined)).rejects.toThrow(UnauthorizedException);
    await expect(authService.getMe('')).rejects.toThrow(UnauthorizedException);
  });

  it('e. invalid/tampered token on getMe -> 401 Unauthorized', async () => {
    await expect(authService.getMe('Bearer invalid_tampered_token')).rejects.toThrow(UnauthorizedException);
  });

  it('f. valid /auth/me returns profile payload', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockActiveUser);

    const secret = getJwtSecret();
    const validToken = jwt.sign(
      { sub: 'usr-101-uuid', type: 'access' },
      secret,
      { expiresIn: '15m' },
    );

    const profile = await authService.getMe(`Bearer ${validToken}`);

    expect(profile).toBeDefined();
    expect(profile.user_id).toBe('usr-101-uuid');
    expect(profile.employee_code).toBe('EMP-001');
    expect(profile.role).toBe('Station Leader');
  });

  it('g. refresh token success', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockActiveUser);

    const secret = getJwtSecret();
    const validRefreshToken = jwt.sign(
      { sub: 'usr-101-uuid', type: 'refresh', jti: 'refresh-test-id' },
      secret,
      { expiresIn: '7d' },
    );

    const result = await authService.refreshToken({ refresh_token: validRefreshToken });

    expect(result).toBeDefined();
    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
  });

  it('h. expired / invalid refresh token -> 401 Unauthorized', async () => {
    await expect(
      authService.refreshToken({ refresh_token: 'invalid_refresh_token' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
