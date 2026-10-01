export type GeoPointValue =
  | { latitude: number; longitude: number }
  | { latitude?: number | null; longitude?: number | null; coordinates?: [number, number] | number[] | null }
  | [number, number]
  | string
  | null
  | undefined

export type Station = {
  station_id: string
  name: string
  code: string
  type?: string | null
  status?: string | null
  timezone?: string | null
  storage_capacity_weight?: number | string | null
  storage_capacity_volume?: number | string | null
  deleted_at?: string | null
  location?: GeoPointValue
  coordinates?: GeoPointValue
}

export type Expedition = {
  expedition_id: string
  code?: string | null
  name?: string | null
  season?: string | null
  status?: string | null
  planned_start?: string | null
  planned_end?: string | null
  current_plan_version_id?: string | null
}

export type TransportLegWaypoint = {
  waypoint_id?: string | null
  leg_id?: string | null
  location?: GeoPointValue
  latitude?: number | null
  longitude?: number | null
  sequence_number?: number | null
  logged_at?: string | null
}

export type TransportLeg = {
  leg_id: string
  code?: string | null
  expedition_id?: string | null
  transport_resource_id?: string | null
  mode?: string | null
  origin?: string | null
  destination?: string | null
  origin_point?: GeoPointValue
  destination_point?: GeoPointValue
  status?: string | null
  planned_departure?: string | null
  planned_arrival?: string | null
  allow_concurrent_leg?: boolean | null
  created_by?: string | null
  waypoints?: TransportLegWaypoint[] | null
}

export type TransportResource = {
  resource_id: string
  name: string
  type: string
  registration_code?: string | null
  max_capacity_weight?: number | string | null
  max_capacity_volume?: number | string | null
  max_seats_berths?: number | null
  status?: string | null
}

export type CargoItem = {
  cargo_id: string
  tracking_code?: string | null
  leg_id?: string | null
  description?: string | null
  category?: string | null
  weight?: string | number | null
  volume?: string | number | null
  hazard_class?: string | number | null
  status?: string | null
}

export type CargoMovementEvent = {
  event_id: string
  cargo_id: string
  leg_id?: string | null
  station_id?: string | null
  event_type: string
  timestamp_utc: string
  actor: string
  reason?: string | null
  actor_user?: {
    user_id: string
    full_name?: string | null
    employee_code?: string | null
  } | null
}

export type ItemCatalog = {
  item_id: string
  item_catalog_id?: string
  name: string
  category?: string | null
  unit?: string | null
  hazard_class?: number | null
  description?: string | null
}

export type InventoryStock = {
  stock_id: string
  station_id?: string | null
  item_catalog_id?: string | null
  item_name?: string | null
  item_category?: string | null
  quantity?: string | number | null
  reorder_threshold?: string | number | null
  safety_stock_minimum?: string | number | null
  last_updated?: string | null
}

export type Personnel = {
  person_id: string
  personnel_id?: string
  user_id?: string | null
  employee_code?: string | null
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  role_on_expedition?: string | null
  role?: string | null
  fitness_status?: string | null
  assigned_station_id?: string | null
  primary_station_id?: string | null
  status?: string | null
}

export type PersonnelAssignment = {
  assignment_id: string
  personnel_id?: string | null
  expedition_id?: string | null
  station_id?: string | null
  leg_id?: string | null
  status?: string | null
  start_date?: string | null
  end_date?: string | null
}

export type Incident = {
  incident_id: string
  leg_id?: string | null
  station_id?: string | null
  type?: string | null
  severity?: string | null
  status?: string | null
  description?: string | null
  declared_at?: string | null
  declared_by?: string | null
  location?: GeoPointValue
}

export type Recommendation = {
  recommendation_id?: string
  recommendation_type?: string | null
  trigger_type?: string | null
  trigger_id?: string | null
  status?: string | null
  proposed_change?: string | Record<string, unknown> | null
  constraint_basis?: string | null
  generated_at?: string | null
}

export type Approval = {
  approval_id: string
  entity_type?: string | null
  entity_id?: string | null
  requested_by?: string | null
  decided_by?: string | null
  decision?: string | null
  status?: string | null
  decided_at?: string | null
  reason?: string | null
  comments?: string | null
}

export type AuditLog = {
  log_id: string
  entity_type: string
  entity_id: string
  actor?: string | null
  device_id?: string | null
  action: string
  old_value?: unknown
  new_value?: unknown
  timestamp_utc: string
  sync_origin?: string | null
  reason?: string | null
  actor_user?: {
    user_id: string
    full_name?: string | null
    employee_code?: string | null
  } | null
}

export type SyncOperation = {
  op_id: string
  device_id?: string | null
  performed_by?: string | null
  local_sequence_number?: number | null
  target_entity_type?: string | null
  target_entity_id?: string | null
  operation_type?: string | null
  payload?: unknown
  status?: string | null
  applied_at?: string | null
  local_timestamp?: string | null
  base_version?: number | null
}

export type WeatherEvent = {
  event_id?: string
  weather_event_id?: string
  station_id?: string | null
  event_type?: string | null
  severity?: string | null
  source?: string | null
  notes?: string | null
  logged_at?: string | null
}

export type User = {
  user_id: string
  full_name: string
  employee_code: string
  email: string
  phone?: string | null
  status?: string | null
  created_at?: string | null
  last_login_at?: string | null
}

export type Role = {
  role_id: string
  name: string
  description?: string | null
}

export type UserRoleAssignment = {
  assignment_id: string
  user_id?: string | null
  role_id?: string | null
  station_id?: string | null
  valid_from?: string | null
  valid_to?: string | null
  is_primary?: boolean
}

export type TransportImpact = {
  transport_leg?: TransportLeg | null
  disruption_status?: string | null
  overall_severity?: string | null
  identified_risks?: string[]
  affected_cargo?: Array<Record<string, unknown>>
  affected_personnel_assignments?: Array<Record<string, unknown>>
  affected_inventory?: Array<Record<string, unknown>>
  recommendation?: Recommendation | null
  incident?: Incident | null
  incident_creation_skipped?: boolean
}
