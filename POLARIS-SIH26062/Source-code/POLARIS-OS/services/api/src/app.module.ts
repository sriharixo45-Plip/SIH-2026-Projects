import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CargoItemsModule } from './cargo-items/cargo-items.module.js';
import { CargoMovementEventsModule } from './cargo-movement-events/cargo-movement-events.module.js';
import { ExpeditionStationsModule } from './expedition-stations/expedition-stations.module.js';
import { ExpeditionsModule } from './expeditions/expeditions.module.js';
import { HealthController } from './health.controller.js';
import { IncidentsModule } from './incidents/incidents.module.js';
import { InventoryStocksModule } from './inventory-stocks/inventory-stocks.module.js';
import { InventoryTransactionsModule } from './inventory-transactions/inventory-transactions.module.js';
import { ItemCatalogModule } from './item-catalog/item-catalog.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { PersonnelAssignmentsModule } from './personnel-assignments/personnel-assignments.module.js';
import { PersonnelModule } from './personnel/personnel.module.js';
import { PlanVersionsModule } from './plan-versions/plan-versions.module.js';
import { PrismaModule } from './prisma.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { ResourceRequestsModule } from './resource-requests/resource-requests.module.js';
import { RolesModule } from './roles/roles.module.js';
import { StationsModule } from './stations/stations.module.js';
import { SyncConflictsModule } from './sync-conflicts/sync-conflicts.module.js';
import { SyncDevicesModule } from './sync-devices/sync-devices.module.js';
import { SyncOperationsModule } from './sync-operations/sync-operations.module.js';
import { TransportLegsModule } from './transport-legs/transport-legs.module.js';
import { TransportResourcesModule } from './transport-resources/transport-resources.module.js';
import { UserRoleAssignmentsModule } from './user-role-assignments/user-role-assignments.module.js';
import { UsersModule } from './users/users.module.js';
import { VesselsModule } from './vessels/vessels.module.js';
import { WeatherEventsModule } from './weather-events/weather-events.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditLogsModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    StationsModule,
    UserRoleAssignmentsModule,
    ApprovalsModule,
    ExpeditionsModule,
    ExpeditionStationsModule,
    PlanVersionsModule,
    TransportResourcesModule,
    TransportLegsModule,
    CargoItemsModule,
    CargoMovementEventsModule,
    ItemCatalogModule,
    InventoryStocksModule,
    InventoryTransactionsModule,
    PersonnelModule,
    PersonnelAssignmentsModule,
    IncidentsModule,
    ResourceRequestsModule,
    RecommendationsModule,
    SyncDevicesModule,
    SyncOperationsModule,
    SyncConflictsModule,
    VesselsModule,
    WeatherEventsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
