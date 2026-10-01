import { useCallback, useEffect, useState } from 'react'
import type { Role, Station, User, UserRoleAssignment } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiGet, apiPatch, apiPost, ApiError } from '../services/api'
import { formatDateTime, recordLabel } from '../utils/display'

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
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [stationId, setStationId] = useState('')
  const [actionError, setActionError] = useState('')
  const [accessRestricted, setAccessRestricted] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setUsersError(''); setRolesError(''); setUsersTechnical(''); setRolesTechnical(''); setAccessRestricted(false)
    const [usersResult, rolesResult, assignmentsResult, stationsResult] = await Promise.allSettled([apiGet<User[]>('/users'), apiGet<Role[]>('/roles'), apiGet<UserRoleAssignment[]>('/user-role-assignments'), apiGet<Station[]>('/stations')])
    if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) setUsers(usersResult.value)
    else { setUsers([]); setUsersError(usersResult.status === 'rejected' ? usersResult.reason instanceof Error ? usersResult.reason.message : 'User directory unavailable.' : 'The API returned an unexpected user data format.'); if (usersResult.status === 'rejected' && usersResult.reason instanceof ApiError) setUsersTechnical(`HTTP ${usersResult.reason.status} · ${usersResult.reason.endpoint}${usersResult.reason.requestId ? ` · Request ID ${usersResult.reason.requestId}` : ''}${usersResult.reason.technicalDetails ? `\n${usersResult.reason.technicalDetails}` : ''}`) }
    if (rolesResult.status === 'fulfilled' && Array.isArray(rolesResult.value)) setRoles(rolesResult.value)
    else { setRoles([]); setRolesError(rolesResult.status === 'rejected' ? rolesResult.reason instanceof Error ? rolesResult.reason.message : 'Role directory unavailable.' : 'The API returned an unexpected role data format.'); if (rolesResult.status === 'rejected' && rolesResult.reason instanceof ApiError) setRolesTechnical(`HTTP ${rolesResult.reason.status} · ${rolesResult.reason.endpoint}${rolesResult.reason.requestId ? ` · Request ID ${rolesResult.reason.requestId}` : ''}${rolesResult.reason.technicalDetails ? `\n${rolesResult.reason.technicalDetails}` : ''}`) }
    if (assignmentsResult.status === 'fulfilled' && Array.isArray(assignmentsResult.value)) setAssignments(assignmentsResult.value)
    else { setAssignments([]); setActionError(assignmentsResult.status === 'rejected' ? assignmentsResult.reason instanceof Error ? assignmentsResult.reason.message : 'Role assignments could not be loaded.' : 'The API returned an unexpected assignment format.') }
    if (stationsResult.status === 'fulfilled' && Array.isArray(stationsResult.value)) setStations(stationsResult.value)
    const denied = [usersResult, rolesResult, assignmentsResult].some((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 403)
    setAccessRestricted(denied)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const assignRole = async (event: React.FormEvent) => {
    event.preventDefault(); setActionError(''); setWorkingId('new')
    try {
      await apiPost('/user-role-assignments', { user_id: selectedUser, role_id: selectedRole, station_id: stationId || undefined, valid_from: new Date().toISOString(), is_primary: false })
      setActionError('Role assignment saved. The server will apply its authorization policy to the next request.')
      await load()
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Role assignment failed.') }
    finally { setWorkingId('') }
  }
  const saveRole = async (assignment: UserRoleAssignment, roleId: string) => {
    if (!roleId || roleId === assignment.role_id) return
    setActionError(''); setWorkingId(assignment.assignment_id)
    try { await apiPatch(`/user-role-assignments/${assignment.assignment_id}`, { role_id: roleId }); setActionError('Role assignment updated.'); await load() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Role update failed.') }
    finally { setWorkingId('') }
  }
  const revoke = async (assignment: UserRoleAssignment) => {
    if (!window.confirm('End this role assignment now?')) return
    setActionError(''); setWorkingId(assignment.assignment_id)
    try { await apiPatch(`/user-role-assignments/${assignment.assignment_id}`, { valid_to: new Date().toISOString() }); setActionError('Role assignment ended.'); await load() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Role assignment could not be ended.') }
    finally { setWorkingId('') }
  }
  if (accessRestricted) return <div className="page-container"><section className="panel access-restricted" role="alert"><p className="eyebrow">ADMINISTRATION</p><h2>ACCESS RESTRICTED</h2><p>You do not have permission to manage users and roles. Your signed-in role does not grant this operational permission.</p><button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>{loading ? 'Checking access…' : 'Retry access check'}</button><details><summary>Technical details</summary><p>{[usersTechnical, rolesTechnical].filter(Boolean).join(' · ') || 'The server denied one or more user administration requests.'}</p></details></section></div>
  return <div className="page-container"><section className="panel"><div className="panel-header"><div><p className="eyebrow">ACCOUNT DIRECTORY</p><h2>{usersError ? 'User data unavailable' : `Users (${users.length})`}</h2></div></div>{usersError && <div className="error-banner" role="alert"><strong>USER DIRECTORY UNAVAILABLE</strong><p>Account information could not be loaded.</p><button type="button" className="btn-link" onClick={() => void load()}>Retry</button>{usersTechnical && <details><summary>Technical details</summary><pre>{usersTechnical}</pre></details>}</div>}{loading ? <p className="data-note" role="status">Loading users...</p> : usersError ? null : !users.length ? <EmptyState message="No user accounts returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>Account</th><th>Employee ID</th><th>Email</th><th>Status</th><th>Last login</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id}><td>{recordLabel(user.full_name, user.user_id, 'Name not provided')}</td><td>{user.employee_code || 'Not provided'}</td><td>{user.email || 'Not provided'}</td><td><StatusPill status={user.status} /></td><td>{user.last_login_at && !Number.isNaN(Date.parse(user.last_login_at)) ? formatDateTime(user.last_login_at, true) : 'Not provided'}</td></tr>)}</tbody></table></div>}</section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">AUTHORIZATION REFERENCE</p><h2>{rolesError ? 'Role data unavailable' : `Roles (${roles.length})`}</h2></div></div>{rolesError && <div className="error-banner" role="alert">Role directory unavailable: {rolesError} <button type="button" className="btn-link" onClick={() => void load()}>Retry</button>{rolesTechnical && <details><summary>Technical details</summary><pre>{rolesTechnical}</pre></details>}</div>}{loading ? <p className="data-note" role="status">Loading roles...</p> : rolesError ? <div className="unavailable-state" role="status">Role records unavailable.</div> : !roles.length ? <EmptyState message="No roles returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>Role</th><th>Description</th></tr></thead><tbody>{roles.map((role) => <tr key={role.role_id}><td>{recordLabel(role.name, role.role_id)}</td><td>{role.description || 'Description not provided'}</td></tr>)}</tbody></table></div>}
      <h3>Assign a role</h3><form className="grid-form" onSubmit={(event) => void assignRole(event)}><label>User<select required value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Select user</option>{users.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name || user.employee_code || user.user_id}</option>)}</select></label><label>Role<select required value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}><option value="">Select role</option>{roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></label><label>Station scope (optional)<select value={stationId} onChange={(event) => setStationId(event.target.value)}><option value="">Global scope</option>{stations.map((station) => <option key={station.station_id} value={station.station_id}>{station.name} ({station.code})</option>)}</select></label><button className="btn-primary" type="submit" disabled={!!workingId || !selectedUser || !selectedRole}>{workingId === 'new' ? 'Saving…' : 'Assign role'}</button></form>
      {actionError && <div className="notice-banner" role="status">{actionError}</div>}
      <h3>Current and prior assignments</h3>{loading ? <p className="data-note" role="status">Loading assignments…</p> : assignments.length === 0 ? <EmptyState compact message="No role assignments returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Station scope</th><th>Validity</th><th>Actions</th></tr></thead><tbody>{assignments.map((assignment) => { const user = users.find((item) => item.user_id === assignment.user_id); const role = roles.find((item) => item.role_id === assignment.role_id); const station = stations.find((item) => item.station_id === assignment.station_id); const active = !assignment.valid_to || Date.parse(assignment.valid_to) > Date.now(); return <tr key={assignment.assignment_id}><td>{recordLabel(user?.full_name, user?.employee_code || assignment.user_id)}</td><td><select aria-label={`Role for ${user?.full_name || assignment.user_id}`} defaultValue={assignment.role_id || ''} onChange={(event) => void saveRole(assignment, event.target.value)} disabled={!active || !!workingId}><option value={assignment.role_id || ''}>{role?.name || assignment.role_id}</option>{roles.filter((item) => item.role_id !== assignment.role_id).map((item) => <option key={item.role_id} value={item.role_id}>{item.name}</option>)}</select></td><td>{station ? `${station.name} (${station.code})` : 'Global'}</td><td>{assignment.valid_from ? formatDateTime(assignment.valid_from) : 'Not provided'} – {assignment.valid_to ? formatDateTime(assignment.valid_to) : 'Active'}</td><td>{active ? <button type="button" className="btn-danger-sm" disabled={!!workingId} onClick={() => void revoke(assignment)}>{workingId === assignment.assignment_id ? 'Saving…' : 'End assignment'}</button> : 'Ended'}</td></tr>})}</tbody></table></div>}
      <p className="data-note">Role assignment changes are API-backed. The API authorization guard decides whether the current account may write; this interface does not grant access.</p></section></div>
}
