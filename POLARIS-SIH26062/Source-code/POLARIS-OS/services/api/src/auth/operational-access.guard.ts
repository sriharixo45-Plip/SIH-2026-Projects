import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

const SAFE_PUBLIC_ROUTES = new Set(['GET /', 'GET /health/db', 'GET /auth/me']);
const READ_METHODS = new Set(['GET', 'HEAD']);

@Injectable()
export class OperationalAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const method = String(request.method).toUpperCase();
    const route = `${request.baseUrl ?? ''}${request.route?.path ?? request.path ?? request.url ?? '/'}`.split('?')[0];
    if (SAFE_PUBLIC_ROUTES.has(`${method} ${route}`)) return true;
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException();

    const path = route.split('/').filter(Boolean);
    const entity = path[0] ?? '';
    const action = READ_METHODS.has(method) ? 'read' : method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';
    const grants = await this.prisma.$queryRawUnsafe<Array<{ entity: string; action: string; station_scope: string | null }>>(
      `SELECT p."entity", p."action", ura."station_id" AS station_scope
       FROM "user_role_assignment" ura
       JOIN "role" r ON r."role_id" = ura."role_id"
       JOIN "permission" p ON p."role_id" = r."role_id"
       JOIN "user" u ON u."user_id" = ura."user_id"
       WHERE ura."user_id" = $1::uuid
         AND u."status" = 'active'
         AND u."deleted_at" IS NULL
         AND ura."valid_from" <= NOW()
         AND (ura."valid_to" IS NULL OR ura."valid_to" > NOW())
         AND (ura."station_id" IS NULL OR ura."station_id" = NULLIF($2, '')::uuid);`,
      userId,
      request.user?.station_id ?? '',
    );
    const allowed = grants.some((grant) => {
      if (!(grant.entity === '*' || grant.entity === entity) || !(grant.action === 'manage' || grant.action === action)) return false;
      if (grant.station_scope === null) return true;
      // Field clients must use the station-filtered change feed; generic operation
      // listing and arbitrary operation lookup would disclose other stations.
      return !(entity === 'sync-operations' && action === 'read') || path[1] === 'changes';
    });
    if (!allowed) throw new ForbiddenException('Your active role assignments do not allow this operation.');
    return true;
  }
}
