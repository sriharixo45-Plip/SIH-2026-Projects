import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuditLog, Role, Station, User, UserRoleAssignment } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import { canonicalStationName, formatDateTime, recordLabel } from '../utils/display'

type DrawerMode = 'profile' | 'assignment' | 'user' | null
const canonicalStation = (station?: Station) => station ? canonicalStationName(station) === 'NCPOR' ? 'NCPOR / Central Operations' : canonicalStationName(station) || `Synthetic station · DEMO (${station.code || station.station_id})` : 'Global scope'

export function UsersRolesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [rolesError, setRolesError] = useState('')
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
    setLoading(true); setUsersError(''); setRolesError(''); setUsersTechnical(''); setRolesTechnical(''); setAccessRestricted(false)
    const results = await Promise.allSettled([apiGet<User[]>('/users'), apiGet<Role[]>('/roles'), apiGet<UserRoleAssignment[]>('/user-role-assignments'), apiGet<Station[]>('/stations')])
    const [usersResult, rolesResult, assignmentsResult, stationsResult] = results
    if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) setUsers(usersResult.value)
    else { setUsers([]); setUsersError(usersResult.status === 'rejected' && usersResult.reason instanceof Error ? usersResult.reason.message : 'User directory unavailable.'); if (usersResult.status === 'rejected' && usersResult.reason instanceof ApiError) setUsersTechnical(`HTTP ${usersResult.reason.status} · ${usersResult.reason.endpoint}${usersResult.reason.requestId ? ` · Request ID ${usersResult.reason.requestId}` : ''}`) }
    if (rolesResult.status === 'fulfilled' && Array.isArray(rolesResult.value)) setRoles(rolesResult.value)
    else { setRoles([]); setRolesError(rolesResult.status === 'rejected' && rolesResult.reason instanceof Error ? rolesResult.reason.message : 'Role directory unavailable.'); if (rolesResult.status === 'rejected' && rolesResult.reason instanceof ApiError) setRolesTechnical(`HTTP ${rolesResult.reason.status} · ${rolesResult.reason.endpoint}${rolesResult.reason.requestId ? ` · Request ID ${rolesResult.reason.requestId}` : ''}`) }
    if (assignmentsResult.status === 'fulfilled' && Array.isArray(assignmentsResult.value)) setAssignments(assignmentsResult.value)
    else setAssignments([])
    if (stationsResult.status === 'fulfilled' && Array.isArray(stationsResult.value)) setStations(stationsResult.value)
    setAccessRestricted(results.slice(0, 3).some((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 403))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (drawer !== 'profile' || !selectedUserId) return
    let current = true
    setActivityState('Loading canonical audit activity…')
    void apiGet<AuditLog[]>('/audit-logs').then((records) => {
      if (!current) return
      const matches = Array.isArray(records) ? records.filter((record) => record.actor === selectedUserId || record.actor_user?.user_id === selectedUserId).slice(0, 8) : []
      setUserActivity(matches)
      setActivityState(matches.length ? '' : 'No canonical audit records are available for this user.')
    }).catch((cause: unknown) => { if (current) { setUserActivity([]); setActivityState(cause instanceof ApiError && cause.status === 403 ? 'Activity records are not available to this account.' : 'Canonical activity is unavailable.') } })
    return () => { current = false }
  }, [drawer, selectedUserId])

  const activeAssignment = (assignment: UserRoleAssignment) => !assignment.valid_to || Date.parse(assignment.valid_to) > Date.now()
  const activeAssignments = assignments.filter(activeAssignment)
  const selectedRecord = users.find((user) => user.user_id === selectedUserId)
  const selectedAssignments = assignments.filter((assignment) => assignment.user_id === selectedUserId)
  const filteredUsers = useMemo(() => users.filter((user) => {
    const userAssignments = assignments.filter((assignment) => assignment.user_id === user.user_id && activeAssignment(assignment))
    const roleMatches = roleFilter === 'ALL' || userAssignments.some((assignment) => assignment.role_id === roleFilter)
    const stationMatches = stationFilter === 'ALL' || userAssignments.some((assignment) => assignment.station_id === stationFilter)
    const statusMatches = statusFilter === 'ALL' || (user.status || '').toUpperCase() === statusFilter
    return roleMatches && stationMatches && statusMatches && `${user.full_name} ${user.employee_code} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase())
  }), [assignments, query, roleFilter, stationFilter, statusFilter, users])

  const assignRole = async (event: FormEvent) => {
    event.preventDefault(); setActionMessage(''); setWorkingId('assignment')
    try { await apiPost('/user-role-assignments', { user_id: selectedUser, role_id: selectedRole, station_id: stationId || undefined, valid_from: new Date().toISOString(), is_primary: false }); setActionMessage('Role assignment saved. Backend authorization remains authoritative.'); setDrawer(null); await load() }
    catch (cause) { setActionMessage(cause instanceof Error ? cause.message : 'Role assignment failed.') }
    finally { setWorkingId('') }
  }
  const createUser = async (event: FormEvent) => {
    event.preventDefault(); setWorkingId('user'); setActionMessage('')
    try { const created = await apiPost<User>('/users', { ...newUser, status: 'active' }); setActionMessage('User record created by the API. Account access is determined by backend credentials and authorization policy.'); setNewUser({ full_name: '', employee_code: '', email: '', phone: '' }); setDrawer(null); await load(); if (created?.user_id) setSelectedUserId(created.user_id) }
    catch (cause) { setActionMessage(cause instanceof Error ? cause.message : 'User record could not be created.') }
    finally { setWorkingId('') }
  }
  const saveRole = async (assignment: UserRoleAssignment, roleId: string) => {
    if (!roleId || roleId === assignment.role_id) return
    setWorkingId(assignment.assignment_id); setActionMessage('')
    try { await apiPatch(`/user-role-assignments/${assignment.assignment_id}`, { role_id: roleId }); setActionMessage('Role assignment updated by the API.'); await load() }
    catch (cause) { setActionMessage(cause instanceof Error ? cause.message : 'Role update failed.') }
    finally { setWorkingId('') }
  }
  const revoke = async (assignment: UserRoleAssignment) => {
    if (!window.confirm('End this role assignment now?')) return
    setWorkingId(assignment.assignment_id); setActionMessage('')
    try { await apiPatch(`/user-role-assignments/${assignment.assignment_id}`, { valid_to: new Date().toISOString() }); setActionMessage('Role assignment ended by the API.'); await load() }
    catch (cause) { setActionMessage(cause instanceof Error ? cause.message : 'Role assignment could not be ended.') }
    finally { setWorkingId('') }
  }

  if (accessRestricted) return <div className="page-container"><section className="panel access-restricted" role="alert"><p className="eyebrow">ADMINISTRATION</p><h2>ACCESS RESTRICTED</h2><p>You do not have permission to manage users and roles. The backend authorization guard controls access.</p><button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>{loading ? 'Checking access…' : 'Retry access check'}</button><details><summary>Technical details</summary><p>{[usersTechnical, rolesTechnical].filter(Boolean).join(' · ') || 'The server denied one or more user administration requests.'}</p></details></section></div>

  return <div className="page-container access-console">
    <header className="page-heading"><div><p className="eyebrow">ADMINISTRATION · API</p><h1>USER & ACCESS MANAGEMENT</h1><p>Directory records, role assignments, and station scope. Backend policy determines effective access.</p></div><button type="button" className="btn-primary" onClick={() => setDrawer('user')}>+ Add user</button></header>
    <div className="ai-signal-grid access-summary">{[['USERS', users.length], ['ROLES', roles.length], ['ACTIVE ASSIGNMENTS', activeAssignments.length], ['PENDING ACTIONS', 'Not provided']].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    {actionMessage && <div className="notice-banner" role="status">{actionMessage}</div>}
    {(usersError || rolesError) && <div className="error-banner" role="alert"><strong>DIRECTORY DATA LIMITED</strong><p>{usersError || rolesError}</p><button type="button" className="btn-link" onClick={() => void load()}>Retry</button>{(usersTechnical || rolesTechnical) && <details><summary>Technical details</summary><p>{[usersTechnical, rolesTechnical].filter(Boolean).join(' · ')}</p></details>}</div>}
    <section className="panel"><div className="access-filter-row"><label>Search users<input className="text-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, employee ID, email" /></label><label>Status<select className="select-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label><label>Role<select className="select-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="ALL">All roles</option>{roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></label><label>Station<select className="select-input" value={stationFilter} onChange={(event) => setStationFilter(event.target.value)}><option value="ALL">All stations</option>{stations.map((station) => <option key={station.station_id} value={station.station_id}>{canonicalStation(station)}</option>)}</select></label></div>
      {loading ? <p className="data-note" role="status">Loading user and access records…</p> : filteredUsers.length === 0 ? <EmptyState message="No API user records match the selected filters." /> : <div className="table-scroll"><table><thead><tr><th>User</th><th>Employee ID</th><th>Role</th><th>Station</th><th>Status</th><th>Last login</th></tr></thead><tbody>{filteredUsers.map((user) => { const assignment = assignments.find((item) => item.user_id === user.user_id && activeAssignment(item)); const role = roles.find((item) => item.role_id === assignment?.role_id); const station = stations.find((item) => item.station_id === assignment?.station_id); return <tr key={user.user_id} className="access-user-row" aria-selected={selectedUserId === user.user_id} tabIndex={0} onClick={() => { setSelectedUserId(user.user_id); setSelectedUser(''); setDrawer('profile') }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedUserId(user.user_id); setSelectedUser(''); setDrawer('profile') } }}><td><strong>{recordLabel(user.full_name, user.user_id, 'Name not provided')}</strong><small className="table-subtext">{user.email || 'Email not provided'}</small></td><td>{user.employee_code || 'Not provided'}</td><td>{role?.name || 'Unassigned'}</td><td>{canonicalStation(station)}</td><td><StatusPill status={user.status} /></td><td>{user.last_login_at ? formatDateTime(user.last_login_at, true) : 'Not recorded'}</td></tr> })}</tbody></table></div>}
    </section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">AUTHORIZATION REFERENCE · API</p><h2>Roles</h2></div></div>{rolesError ? <p className="data-note">Role data unavailable. {rolesError}</p> : roles.length === 0 ? <EmptyState compact message="No API roles returned." /> : <div className="access-role-grid">{roles.map((role) => <article key={role.role_id}><strong>{role.name}</strong><small>{role.description || 'Description unavailable'}</small></article>)}</div>}</section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">ASSIGNMENT HISTORY · API</p><h2>Current and prior assignments</h2></div><button type="button" className="btn-secondary-sm" onClick={() => setDrawer('assignment')}>Assign role</button></div>{assignments.length === 0 ? <EmptyState compact message="No role assignments returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Station scope</th><th>Validity</th><th>State / action</th></tr></thead><tbody>{assignments.map((assignment) => { const user = users.find((item) => item.user_id === assignment.user_id); const role = roles.find((item) => item.role_id === assignment.role_id); const station = stations.find((item) => item.station_id === assignment.station_id); const active = activeAssignment(assignment); return <tr key={assignment.assignment_id}><td>{recordLabel(user?.full_name, user?.employee_code || assignment.user_id)}</td><td><select aria-label={`Role for ${user?.full_name || assignment.user_id}`} value={assignment.role_id || ''} onChange={(event) => void saveRole(assignment, event.target.value)} disabled={!active || !!workingId}><option value={assignment.role_id || ''}>{role?.name || assignment.role_id}</option>{roles.filter((item) => item.role_id !== assignment.role_id).map((item) => <option key={item.role_id} value={item.role_id}>{item.name}</option>)}</select></td><td>{canonicalStation(station)}</td><td>{assignment.valid_from ? formatDateTime(assignment.valid_from) : 'Not provided'} – {assignment.valid_to ? formatDateTime(assignment.valid_to) : 'Open'}</td><td>{active ? <><StatusPill status="active" /><button type="button" className="btn-danger-sm" disabled={!!workingId} onClick={() => void revoke(assignment)}>{workingId === assignment.assignment_id ? 'Saving…' : 'End assignment'}</button></> : <StatusPill status="ended" />}</td></tr> })}</tbody></table></div>}</section>
    <p className="data-note">Role assignments are persisted through the API. Changing a UI assignment does not itself grant authorization; backend guards remain authoritative.</p>

    {drawer && <div className="access-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawer(null) }}><aside className="access-drawer" role="dialog" aria-modal="true" aria-label={drawer === 'profile' ? 'User profile' : drawer === 'assignment' ? 'Assign role' : 'Add user'}><div className="panel-header"><div><p className="eyebrow">USER & ACCESS MANAGEMENT</p><h2>{drawer === 'profile' ? 'PROFILE' : drawer === 'assignment' ? 'ASSIGN ROLE' : 'ADD USER'}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setDrawer(null)}>×</button></div>
      {drawer === 'profile' && selectedRecord && <><div className="access-profile"><strong>{selectedRecord.full_name}</strong><span>{selectedRecord.employee_code} · {selectedRecord.email}</span><StatusPill status={selectedRecord.status} /></div><h3>ACCESS & ROLES</h3>{selectedAssignments.length ? selectedAssignments.filter(activeAssignment).map((assignment) => <div className="access-history-row" key={assignment.assignment_id}><strong>{roles.find((role) => role.role_id === assignment.role_id)?.name || 'Role unavailable'}</strong><span>Active · {stations.find((station) => station.station_id === assignment.station_id) ? canonicalStation(stations.find((station) => station.station_id === assignment.station_id)) : 'Global scope'}</span></div>) : <p className="data-note">No active role assignments.</p>}<h3>STATION SCOPE</h3><p>{selectedAssignments.filter(activeAssignment).map((assignment) => canonicalStation(stations.find((station) => station.station_id === assignment.station_id))).join(', ') || 'No assigned station scope.'}</p><h3>ACTIVITY</h3><p>Last login: {selectedRecord.last_login_at ? formatDateTime(selectedRecord.last_login_at) : 'Not recorded by API'}.</p>{activityState && <p className="data-note">{activityState}</p>}{userActivity.map((event) => <div className="access-history-row" key={event.log_id}><strong>{event.action || 'No action'} · {event.entity_type}</strong><span>{event.entity_id}</span><small>{formatDateTime(event.timestamp_utc)}</small></div>)}<h3>ASSIGNMENT HISTORY</h3>{selectedAssignments.length ? selectedAssignments.map((assignment) => <div className="access-history-row" key={assignment.assignment_id}><strong>{roles.find((role) => role.role_id === assignment.role_id)?.name || 'Role unavailable'}</strong><span>{activeAssignment(assignment) ? 'Active' : 'Ended'} · {stations.find((station) => station.station_id === assignment.station_id) ? canonicalStation(stations.find((station) => station.station_id === assignment.station_id)) : 'Global scope'}</span><small>{assignment.valid_from ? formatDateTime(assignment.valid_from) : 'Start unavailable'} – {assignment.valid_to ? formatDateTime(assignment.valid_to) : 'Current'}</small></div>) : <p className="data-note">No role assignment history returned.</p>}<button type="button" className="btn-primary-sm" onClick={() => { setSelectedUser(selectedRecord.user_id); setDrawer('assignment') }}>Assign role</button></>}
      {drawer === 'assignment' && <form className="access-form" onSubmit={(event) => void assignRole(event)}><label>User<select required value={selectedUser || selectedUserId} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Select user</option>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name} · {user.employee_code}</option>)}</select></label><label>Role<select required value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}><option value="">Select role</option>{roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></label><label>Station scope<select value={stationId} onChange={(event) => setStationId(event.target.value)}><option value="">Global scope</option>{stations.map((station) => <option key={station.station_id} value={station.station_id}>{canonicalStation(station)}</option>)}</select></label>{actionMessage && <p role="alert">{actionMessage}</p>}<button type="submit" className="btn-primary" disabled={!!workingId || !selectedUser && !selectedUserId || !selectedRole}>{workingId === 'assignment' ? 'Saving…' : 'Save assignment'}</button><p className="data-note">The server evaluates this assignment against its authorization policy.</p></form>}
      {drawer === 'user' && <form className="access-form" onSubmit={(event) => void createUser(event)}><label>Full name<input required className="text-input" value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} /></label><label>Employee ID<input required className="text-input" value={newUser.employee_code} onChange={(event) => setNewUser({ ...newUser, employee_code: event.target.value })} /></label><label>Email<input required type="email" className="text-input" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></label><label>Phone<input className="text-input" value={newUser.phone} onChange={(event) => setNewUser({ ...newUser, phone: event.target.value })} /></label>{actionMessage && <p role="alert">{actionMessage}</p>}<button type="submit" className="btn-primary" disabled={!!workingId}>{workingId === 'user' ? 'Saving…' : 'Create user record'}</button><p className="data-note">This calls the existing user API. Authentication credentials and access assignments are managed separately.</p></form>}
    </aside></div>}
  </div>
}
