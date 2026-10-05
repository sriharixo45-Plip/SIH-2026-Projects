import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuditLog, Role, Station, User, UserRoleAssignment } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import { canonicalStationName, formatDateTime, recordLabel } from '../utils/display'

type DrawerMode = 'profile' | 'assignment' | 'user' | null

const canonicalStation = (station?: Station) =>
  station
    ? canonicalStationName(station) === 'NCPOR'
      ? 'NCPOR / Central Operations'
      : canonicalStationName(station) || `Synthetic station · DEMO (${station.code || station.station_id})`
    : 'Global HQ'

export function UsersRolesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [rolesError, setRolesError] = useState('')
  const [assignmentsError, setAssignmentsError] = useState('')
  const [stationsError, setStationsError] = useState('')
  const [usersTechnical, setUsersTechnical] = useState('')
  const [rolesTechnical, setRolesTechnical] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [accessRestricted, setAccessRestricted] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [stationFilter, setStationFilter] = useState('ALL')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [drawer, setDrawer] = useState<DrawerMode>(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [stationId, setStationId] = useState('')
  const [newUser, setNewUser] = useState({ full_name: '', employee_code: '', email: '', phone: '' })
  const [userActivity, setUserActivity] = useState<AuditLog[]>([])
  const [activityState, setActivityState] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setUsersError('')
    setRolesError('')
    setAssignmentsError('')
    setStationsError('')
    setUsersTechnical('')
    setRolesTechnical('')
    setAccessRestricted(false)
    const results = await Promise.allSettled([
      apiGet<User[]>('/users'),
      apiGet<Role[]>('/roles'),
      apiGet<UserRoleAssignment[]>('/user-role-assignments'),
      apiGet<Station[]>('/stations'),
    ])
    const [usersResult, rolesResult, assignmentsResult, stationsResult] = results
    if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) {
      setUsers(usersResult.value)
    } else {
      setUsers([])
      setUsersError(
        usersResult.status === 'rejected' && usersResult.reason instanceof Error
          ? usersResult.reason.message
          : 'User directory unavailable.',
      )
      if (usersResult.status === 'rejected' && usersResult.reason instanceof ApiError) {
        setUsersTechnical(
          `HTTP ${usersResult.reason.status} · ${usersResult.reason.endpoint}${usersResult.reason.requestId ? ` · Request ID ${usersResult.reason.requestId}` : ''}`,
        )
      }
    }
    if (rolesResult.status === 'fulfilled' && Array.isArray(rolesResult.value)) {
      setRoles(rolesResult.value)
    } else {
      setRoles([])
      setRolesError(
        rolesResult.status === 'rejected' && rolesResult.reason instanceof Error
          ? rolesResult.reason.message
          : 'Role directory unavailable.',
      )
      if (rolesResult.status === 'rejected' && rolesResult.reason instanceof ApiError) {
        setRolesTechnical(
          `HTTP ${rolesResult.reason.status} · ${rolesResult.reason.endpoint}${rolesResult.reason.requestId ? ` · Request ID ${rolesResult.reason.requestId}` : ''}`,
        )
      }
    }
    if (assignmentsResult.status === 'fulfilled' && Array.isArray(assignmentsResult.value)) {
      setAssignments(assignmentsResult.value)
    } else {
      setAssignments([])
      setAssignmentsError(
        assignmentsResult.status === 'rejected' && assignmentsResult.reason instanceof Error
          ? assignmentsResult.reason.message
          : 'Role assignment records unavailable.',
      )
    }
    if (stationsResult.status === 'fulfilled' && Array.isArray(stationsResult.value)) {
      setStations(stationsResult.value)
    } else {
      setStations([])
      setStationsError(
        stationsResult.status === 'rejected' && stationsResult.reason instanceof Error
          ? stationsResult.reason.message
          : 'Station references unavailable.',
      )
    }
    setAccessRestricted(
      results.slice(0, 3).some((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 403),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (drawer !== 'profile' || !selectedUserId) return
    let current = true
    setActivityState('Loading canonical audit activity…')
    void apiGet<AuditLog[]>('/audit-logs')
      .then((records) => {
        if (!current) return
        const matches = Array.isArray(records)
          ? records
              .filter((record) => record.actor === selectedUserId || record.actor_user?.user_id === selectedUserId)
              .slice(0, 8)
          : []
        setUserActivity(matches)
        setActivityState(matches.length ? '' : 'No canonical audit records are available for this user.')
      })
      .catch((cause: unknown) => {
        if (current) {
          setUserActivity([])
          setActivityState(
            cause instanceof ApiError && cause.status === 403
              ? 'Activity records are not available to this account.'
              : 'Canonical activity is unavailable.',
          )
        }
      })
    return () => {
      current = false
    }
  }, [drawer, selectedUserId])

  const [now] = useState(() => Date.now())
  const activeAssignment = (assignment: UserRoleAssignment) =>
    !assignment.valid_to || Date.parse(assignment.valid_to) > now
  const activeAssignments = assignments.filter(activeAssignment)
  const selectedRecord = users.find((user) => user.user_id === selectedUserId)
  const selectedAssignments = assignments.filter((assignment) => assignment.user_id === selectedUserId)

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const userAssignments = assignments.filter(
        (assignment) => assignment.user_id === user.user_id && activeAssignment(assignment),
      )
      const roleMatches =
        roleFilter === 'ALL' || userAssignments.some((assignment) => assignment.role_id === roleFilter)
      const stationMatches =
        stationFilter === 'ALL' || userAssignments.some((assignment) => assignment.station_id === stationFilter)
      const statusMatches = statusFilter === 'ALL' || (user.status || '').toUpperCase() === statusFilter
      return (
        roleMatches &&
        stationMatches &&
        statusMatches &&
        `${user.full_name} ${user.employee_code} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    })
  }, [assignments, query, roleFilter, stationFilter, statusFilter, users])

  const assignRole = async (event: FormEvent) => {
    event.preventDefault()
    setActionMessage('')
    setWorkingId('assignment')
    try {
      await apiPost('/user-role-assignments', {
        user_id: selectedUser,
        role_id: selectedRole,
        station_id: stationId || undefined,
        valid_from: new Date().toISOString(),
        is_primary: false,
      })
      setActionMessage('Role assignment saved. Backend authorization remains authoritative.')
      setDrawer(null)
      await load()
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Role assignment failed.')
    } finally {
      setWorkingId('')
    }
  }

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    setWorkingId('user')
    setActionMessage('')
    try {
      const created = await apiPost<User>('/users', { ...newUser, status: 'active' })
      setActionMessage(
        'User record created by the API. Account access is determined by backend credentials and authorization policy.',
      )
      setNewUser({ full_name: '', employee_code: '', email: '', phone: '' })
      setDrawer(null)
      await load()
      if (created?.user_id) setSelectedUserId(created.user_id)
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'User record could not be created.')
    } finally {
      setWorkingId('')
    }
  }

  const saveRole = async (assignment: UserRoleAssignment, roleId: string) => {
    if (!roleId || roleId === assignment.role_id) return
    setWorkingId(assignment.assignment_id)
    setActionMessage('')
    try {
      await apiPatch(`/user-role-assignments/${assignment.assignment_id}`, { role_id: roleId })
      setActionMessage('Role assignment updated by the API.')
      await load()
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Role update failed.')
    } finally {
      setWorkingId('')
    }
  }

  const revoke = async (assignment: UserRoleAssignment) => {
    if (!window.confirm('End this role assignment now?')) return
    setWorkingId(assignment.assignment_id)
    setActionMessage('')
    try {
      await apiPatch(`/user-role-assignments/${assignment.assignment_id}`, { valid_to: new Date().toISOString() })
      setActionMessage('Role assignment ended by the API.')
      await load()
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Role assignment could not be ended.')
    } finally {
      setWorkingId('')
    }
  }

  if (accessRestricted) {
    return (
      <div className="page-container">
        <section className="panel access-restricted" role="alert">
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>ACCESS RESTRICTED</h2>
          <p>You do not have permission to manage users and roles. The backend authorization guard controls access.</p>
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? 'Checking access…' : 'Retry access check'}
          </button>
          <details>
            <summary>Technical details</summary>
            <p>
              {[usersTechnical, rolesTechnical].filter(Boolean).join(' · ') ||
                'The server denied one or more user administration requests.'}
            </p>
          </details>
        </section>
      </div>
    )
  }

  // KPIs
  const totalUsers = users.length
  const activeUsers = users.filter((u) => (u.status || '').toLowerCase() === 'active').length
  const stationScopedCount = new Set(activeAssignments.filter((a) => Boolean(a.station_id)).map((a) => a.user_id)).size

  return (
    <div className="page-container access-console">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">IDENTITY & ACCESS GOVERNANCE</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Users &amp; Roles Management</h2>
          <p className="page-subtitle">
            Operator accounts, role-based authorization scopes, station delegation, and canonical audit history.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn-primary" onClick={() => setDrawer('user')}>
            + Add Operator
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Access KPIs">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL OPERATORS</span>
          <span className="kpi-value">{usersError ? '—' : totalUsers}</span>
          <span className="kpi-hint">Registered directory accounts</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">ACTIVE STATUS</span>
          <span className="kpi-value success">{usersError ? '—' : activeUsers}</span>
          <span className="kpi-hint">Enabled credentials</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">DEFINED ROLES</span>
          <span className="kpi-value info">{rolesError ? '—' : roles.length}</span>
          <span className="kpi-hint">RBAC authority policies</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">ACTIVE GRANTS</span>
          <span className="kpi-value warning">{assignmentsError ? '—' : activeAssignments.length}</span>
          <span className="kpi-hint">Active role assignments</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">STATION-SCOPED</span>
          <span className="kpi-value">{assignmentsError ? '—' : stationScopedCount}</span>
          <span className="kpi-hint">Station-restricted operators</span>
        </div>
      </section>

      {actionMessage && (
        <div className="notice-banner" role="status">
          {actionMessage}
        </div>
      )}
      {stationsError && (
        <div className="unavailable-state" role="status">
          Station scope references unavailable. {stationsError}
          <button type="button" className="btn-link" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {(usersError || rolesError) && (
        <div className="error-banner" role="alert">
          <strong>DIRECTORY DATA LIMITED</strong>
          <p>{usersError || rolesError}</p>
          <button type="button" className="btn-link" onClick={() => void load()}>
            Retry
          </button>
          {(usersTechnical || rolesTechnical) && (
            <details>
              <summary>Technical details</summary>
              <p>{[usersTechnical, rolesTechnical].filter(Boolean).join(' · ')}</p>
            </details>
          )}
        </div>
      )}

      {/* Main Users Table Section */}
      <section className="panel">
        <div className="operational-toolbar">
          <div className="filter-group">
            <label htmlFor="user-search" className="sr-only">
              Search directory
            </label>
            <input
              id="user-search"
              type="search"
              className="text-input filter-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search operator name, ID, or email..."
            />
          </div>
          <div className="filter-group">
            <label htmlFor="user-status-filter" className="filter-label">
              Status:
            </label>
            <select
              id="user-status-filter"
              className="select-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="user-role-filter" className="filter-label">
              Role:
            </label>
            <select
              id="user-role-filter"
              className="select-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All roles</option>
              {roles.map((r) => (
                <option key={r.role_id} value={r.role_id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="user-station-filter" className="filter-label">
              Station:
            </label>
            <select
              id="user-station-filter"
              className="select-input"
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
            >
              <option value="ALL">All stations</option>
              {stations.map((st) => (
                <option key={st.station_id} value={st.station_id}>
                  {canonicalStation(st)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="data-note" role="status">
            Loading user directory and access policies…
          </p>
        ) : filteredUsers.length === 0 ? (
          <EmptyState message="No API user records match the selected filters." />
        ) : (
          <div className="table-scroll">
            <table className="dense-table" aria-label="Operator Directory">
              <thead>
                <tr>
                  <th>Operator Profile</th>
                  <th>Employee Code</th>
                  <th>Assigned Role</th>
                  <th>Station Scope</th>
                  <th>Account Status</th>
                  <th>Last Authentication</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const assignment = assignments.find((item) => item.user_id === user.user_id && activeAssignment(item))
                  const role = roles.find((item) => item.role_id === assignment?.role_id)
                  const station = stations.find((item) => item.station_id === assignment?.station_id)
                  const isSelected = selectedUserId === user.user_id

                  return (
                    <tr
                      key={user.user_id}
                      className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedUserId(user.user_id)
                        setSelectedUser('')
                        setDrawer('profile')
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedUserId(user.user_id)
                          setSelectedUser('')
                          setDrawer('profile')
                        }
                      }}
                    >
                      <td>
                        <div className="cell-primary">
                          <strong>{recordLabel(user.full_name, user.user_id, 'Name not provided')}</strong>
                          <span className="table-subtext">{user.email || 'Email not provided'}</span>
                        </div>
                      </td>
                      <td>
                        <code className="record-code">{user.employee_code || 'N/A'}</code>
                      </td>
                      <td>
                        {assignmentsError ? (
                          <span className="text-muted">Unavailable</span>
                        ) : role?.name ? (
                          <span className="badge-tag">{role.name}</span>
                        ) : assignment ? (
                          <span className="badge-tag">Role mapped</span>
                        ) : (
                          <span className="text-muted">No role</span>
                        )}
                      </td>
                      <td>
                        {assignmentsError
                          ? 'Unavailable'
                          : stationsError && assignment?.station_id
                            ? 'Station scope unavailable'
                            : assignment?.station_id && !station
                              ? 'Station mapping unavailable'
                              : canonicalStation(station)}
                      </td>
                      <td>
                        <StatusPill status={user.status} />
                      </td>
                      <td>
                        {user.last_login_at ? formatDateTime(user.last_login_at, true) : <span className="text-muted">Never</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Roles Reference Cards */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">AUTHORIZATION REFERENCE</p>
            <h3>Configured Roles ({roles.length})</h3>
          </div>
        </div>
        {rolesError ? (
          <p className="data-note">Role data unavailable. {rolesError}</p>
        ) : roles.length === 0 ? (
          <EmptyState compact message="No API roles returned." />
        ) : (
          <div className="access-role-grid">
            {roles.map((role) => (
              <article key={role.role_id} className="role-card">
                <div className="role-header">
                  <strong>{role.name}</strong>
                  <code className="code-badge">{role.role_id}</code>
                </div>
                <p className="role-desc">{role.description || 'No policy description provided.'}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Role Assignment History & Governance */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">ACCESS GOVERNANCE LEDGER</p>
            <h3>Role Assignments ({assignments.length})</h3>
          </div>
          <button type="button" className="btn-secondary-sm" onClick={() => setDrawer('assignment')}>
            + Assign Role
          </button>
        </div>
        {assignmentsError ? (
          <div className="unavailable-state" role="alert">
            Role assignment history unavailable. {assignmentsError}
            <button type="button" className="btn-link" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState compact message="No role assignments returned by the API." />
        ) : (
          <div className="table-scroll">
            <table className="dense-table" aria-label="Role Assignments Ledger">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Assigned Role</th>
                  <th>Station Scope</th>
                  <th>Validity Period</th>
                  <th>Status &amp; Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const user = users.find((item) => item.user_id === assignment.user_id)
                  const role = roles.find((item) => item.role_id === assignment.role_id)
                  const station = stations.find((item) => item.station_id === assignment.station_id)
                  const active = activeAssignment(assignment)

                  return (
                    <tr key={assignment.assignment_id}>
                      <td>
                        <strong>{recordLabel(user?.full_name, user?.employee_code || assignment.user_id)}</strong>
                      </td>
                      <td>
                        <select
                          className="select-input input-compact"
                          aria-label={`Role for ${user?.full_name || assignment.user_id}`}
                          value={assignment.role_id || ''}
                          onChange={(event) => void saveRole(assignment, event.target.value)}
                          disabled={!active || Boolean(workingId)}
                        >
                          <option value={assignment.role_id || ''}>{role?.name || assignment.role_id}</option>
                          {roles
                            .filter((item) => item.role_id !== assignment.role_id)
                            .map((item) => (
                              <option key={item.role_id} value={item.role_id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>{canonicalStation(station)}</td>
                      <td>
                        {assignment.valid_from ? formatDateTime(assignment.valid_from) : 'Immediate'} –{' '}
                        {assignment.valid_to ? formatDateTime(assignment.valid_to) : 'Permanent'}
                      </td>
                      <td>
                        <div className="status-action-row">
                          <StatusPill status={active ? 'active' : 'ended'} />
                          {active && (
                            <button
                              type="button"
                              className="btn-danger-sm"
                              disabled={Boolean(workingId)}
                              onClick={() => void revoke(assignment)}
                            >
                              {workingId === assignment.assignment_id ? 'Saving…' : 'End'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drawers */}
      {drawer && (
        <div
          className="access-drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawer(null)
          }}
        >
          <aside
            className="access-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={drawer === 'profile' ? 'User profile' : drawer === 'assignment' ? 'Assign role' : 'Add user'}
          >
            <div className="drawer-header">
              <div>
                <span className="eyebrow">
                  {drawer === 'profile' ? 'OPERATOR PROFILE' : drawer === 'assignment' ? 'ROLE DELEGATION' : 'NEW OPERATOR'}
                </span>
                <h3>{drawer === 'profile' ? 'User Details' : drawer === 'assignment' ? 'Assign Role' : 'Create User'}</h3>
              </div>
              <button type="button" className="btn-icon" aria-label="Close" onClick={() => setDrawer(null)}>
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {drawer === 'profile' && selectedRecord && (
                <>
                  <div className="drawer-section">
                    <span className="section-label">OPERATOR IDENTIFICATION</span>
                    <h4>{selectedRecord.full_name}</h4>
                    <p className="detail-value">
                      Employee ID: {selectedRecord.employee_code} · {selectedRecord.email}
                    </p>
                    <div style={{ marginTop: '8px' }}>
                      <StatusPill status={selectedRecord.status} />
                    </div>
                  </div>

                  <div className="drawer-section">
                    <span className="section-label">ACTIVE AUTHORIZATIONS</span>
                    {selectedAssignments.length ? (
                      selectedAssignments.filter(activeAssignment).map((assignment) => (
                        <div className="detail-box" key={assignment.assignment_id} style={{ marginBottom: '8px' }}>
                          <div className="detail-box-row">
                            <span className="box-label">ROLE:</span>
                            <strong>{roles.find((r) => r.role_id === assignment.role_id)?.name || 'Role unavailable'}</strong>
                          </div>
                          <div className="detail-box-row">
                            <span className="box-label">SCOPE:</span>
                            <span>
                              {stations.find((st) => st.station_id === assignment.station_id)
                                ? canonicalStation(stations.find((st) => st.station_id === assignment.station_id))
                                : 'Global HQ'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-secondary">No active role assignments.</p>
                    )}
                  </div>

                  <div className="drawer-section">
                    <span className="section-label">CANONICAL AUDIT ACTIVITY</span>
                    {activityState && <p className="data-note">{activityState}</p>}
                    <ul className="timeline-list">
                      {userActivity.map((event) => (
                        <li key={event.log_id} className="timeline-item">
                          <div className="timeline-marker" />
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <strong>{event.action || 'Action'}</strong>
                              <span className="timeline-date">{formatDateTime(event.timestamp_utc)}</span>
                            </div>
                            <span className="table-subtext">
                              {event.entity_type} · {event.entity_id}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="drawer-section">
                    <button
                      type="button"
                      className="btn-primary full-width"
                      onClick={() => {
                        setSelectedUser(selectedRecord.user_id)
                        setDrawer('assignment')
                      }}
                    >
                      Assign New Role
                    </button>
                  </div>
                </>
              )}

              {drawer === 'assignment' && (
                <form className="access-form" onSubmit={(event) => void assignRole(event)}>
                  <div className="form-group">
                    <label htmlFor="assign-user-select">Operator Account</label>
                    <select
                      id="assign-user-select"
                      className="select-input"
                      required
                      value={selectedUser || selectedUserId}
                      onChange={(event) => setSelectedUser(event.target.value)}
                    >
                      <option value="">Select operator…</option>
                      {users.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.full_name} · {user.employee_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="assign-role-select">Role Authority</label>
                    <select
                      id="assign-role-select"
                      className="select-input"
                      required
                      value={selectedRole}
                      onChange={(event) => setSelectedRole(event.target.value)}
                    >
                      <option value="">Select role…</option>
                      {roles.map((role) => (
                        <option key={role.role_id} value={role.role_id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="assign-station-select">Station / Base Scope</label>
                    <select
                      id="assign-station-select"
                      className="select-input"
                      value={stationId}
                      onChange={(event) => setStationId(event.target.value)}
                    >
                      <option value="">Global HQ scope</option>
                      {stations.map((station) => (
                        <option key={station.station_id} value={station.station_id}>
                          {canonicalStation(station)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {actionMessage && <p className="form-note alert">{actionMessage}</p>}
                  <button
                    type="submit"
                    className="btn-primary full-width"
                    disabled={Boolean(workingId) || (!selectedUser && !selectedUserId) || !selectedRole}
                  >
                    {workingId === 'assignment' ? 'Saving…' : 'Save Role Grant'}
                  </button>
                </form>
              )}

              {drawer === 'user' && (
                <form className="access-form" onSubmit={(event) => void createUser(event)}>
                  <div className="form-group">
                    <label htmlFor="new-user-name">Full Name</label>
                    <input
                      id="new-user-name"
                      required
                      className="text-input"
                      value={newUser.full_name}
                      onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-user-emp">Employee Code / ID</label>
                    <input
                      id="new-user-emp"
                      required
                      className="text-input"
                      value={newUser.employee_code}
                      onChange={(event) => setNewUser({ ...newUser, employee_code: event.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-user-email">Official Email</label>
                    <input
                      id="new-user-email"
                      required
                      type="email"
                      className="text-input"
                      value={newUser.email}
                      onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-user-phone">Phone / Satellite Comm</label>
                    <input
                      id="new-user-phone"
                      className="text-input"
                      value={newUser.phone}
                      onChange={(event) => setNewUser({ ...newUser, phone: event.target.value })}
                    />
                  </div>
                  {actionMessage && <p className="form-note alert">{actionMessage}</p>}
                  <button type="submit" className="btn-primary full-width" disabled={Boolean(workingId)}>
                    {workingId === 'user' ? 'Creating…' : 'Create Operator Account'}
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
