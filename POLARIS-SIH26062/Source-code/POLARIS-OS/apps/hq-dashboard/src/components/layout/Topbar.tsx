import { useMemo, useState, useSyncExternalStore } from 'react'
import { PolarClock } from '../common/PolarClock'
import { StatusPill } from '../common/StatusPill'
import { recordLabel } from '../../utils/display'
import { demoOperationsStore } from '../../services/operations-demo'
import { demoBases } from '../../mock-data/operations'
import type { CargoItem, Expedition, Incident, Personnel, Station, TransportLeg } from '../../types'

type UserSummary = { full_name?: string | null; email?: string | null; employee_code?: string | null; role?: string | null; scope?: string | null }
type TopbarProps = { title: string; subtitle: string; connection: 'checking' | 'connected' | 'error'; lastRefresh: string | null; onRefresh: () => void; isRefreshing: boolean; user: UserSummary; onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void; onNavigate:(route:string)=>void; apiData:{stations:Station[];expeditions:Expedition[];cargoItems:CargoItem[];personnel:Personnel[];incidents:Incident[];transportLegs:TransportLeg[]} }

export function Topbar({ title, subtitle, connection, lastRefresh, onRefresh, isRefreshing, user, onLogout, theme, onToggleTheme, onNavigate, apiData }: TopbarProps) {
  const [query,setQuery]=useState('');const [searchOpen,setSearchOpen]=useState(false)
  const state=useSyncExternalStore(demoOperationsStore.subscribe,demoOperationsStore.getState,demoOperationsStore.getState)
  const results=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return [];const rows=[
    ...state.assets.map(x=>({type:x.kind==='ship'?'SHIP':'FLIGHT',label:`${x.id} · ${x.name}`,match:`${x.id} ${x.name} ${x.registration} ${x.imo??''} ${x.mmsi??''}`,go:()=>{sessionStorage.setItem('polaris_map_focus',x.id);onNavigate('tracking')}})),
    ...state.operations.map(x=>({type:'OPERATION',label:`${x.id} · ${x.name}`,match:`${x.id} ${x.name} ${x.destination}`,go:()=>{sessionStorage.setItem('polaris_operation_focus',x.id);onNavigate('demo-operations')}})),
    ...state.cargo.map(x=>({type:'CARGO',label:`${x.id} · ${x.description}`,match:`${x.id} ${x.description} ${x.category} ${x.assetId} ${x.operationId}`,go:()=>{sessionStorage.setItem('polaris_cargo_focus',x.assetId);onNavigate('demo-cargo')}})),
    ...state.employees.map(x=>({type:'PERSONNEL',label:`${x.id} · ${x.name}`,match:`${x.id} ${x.name} ${x.role} ${x.base} ${x.operationId??''}`,go:()=>{sessionStorage.setItem('polaris_employee_focus',x.id);onNavigate('personnel')}})),
    ...demoBases.map(x=>({type:'BASE',label:`${x.id} · ${x.name}`,match:`${x.id} ${x.name} ${x.region}`,go:()=>onNavigate('bases')})),
    ...state.incidents.map(x=>({type:'INCIDENT',label:`${x.id} · ${x.type}`,match:`${x.id} ${x.type} ${x.description} ${x.base}`,go:()=>{sessionStorage.setItem('polaris_incident_focus',x.id);const a=state.assets.find(a=>a.operationId===x.operationId);if(a)sessionStorage.setItem('polaris_map_focus',a.id);onNavigate('incidents')}})),
    ...apiData.expeditions.map(x=>({type:'EXPEDITION',label:`${x.code||x.expedition_id} · ${x.name||'Expedition'}`,match:`${x.code??''} ${x.expedition_id} ${x.name??''} ${x.season??''}`,go:()=>onNavigate('expeditions')})),
    ...apiData.transportLegs.map(x=>({type:'TRANSPORT',label:`${x.code||x.leg_id} · ${x.origin||'Origin'} to ${x.destination||'Destination'}`,match:`${x.code??''} ${x.leg_id} ${x.origin??''} ${x.destination??''} ${x.status??''}`,go:()=>onNavigate('transport')})),
    ...apiData.cargoItems.map(x=>({type:'API CARGO',label:`${x.tracking_code||x.cargo_id} · ${x.description||x.category||'Cargo record'}`,match:`${x.tracking_code??''} ${x.cargo_id} ${x.description??''} ${x.category??''}`,go:()=>onNavigate('cargo')})),
    ...apiData.personnel.map(x=>({type:'API PERSONNEL',label:`${x.employee_code||x.person_id} · ${x.name||[x.first_name,x.last_name].filter(Boolean).join(' ')}`,match:`${x.employee_code??''} ${x.person_id} ${x.name??''} ${x.first_name??''} ${x.last_name??''} ${x.role??''}`,go:()=>{sessionStorage.setItem('polaris_api_person_focus',x.person_id);onNavigate('personnel')}})),
    ...apiData.stations.map(x=>({type:'API BASE',label:`${x.code||x.station_id} · ${x.name}`,match:`${x.code} ${x.station_id} ${x.name}`,go:()=>{const base=demoBases.find(b=>b.id===x.code?.toUpperCase()||b.name.toLowerCase()===x.name.toLowerCase());if(base&&base.point.lat < -32)sessionStorage.setItem('polaris_base_focus',base.id);else sessionStorage.setItem('polaris_map_search',x.name);onNavigate('tracking')}})),
    ...apiData.incidents.map(x=>({type:'API INCIDENT',label:`${x.incident_id} · ${x.type||'Incident'}`,match:`${x.incident_id} ${x.type??''} ${x.description??''} ${x.status??''}`,go:()=>{sessionStorage.setItem('polaris_api_incident_focus',x.incident_id);onNavigate('incidents')}})),
  ];return rows.filter(x=>x.match.toLowerCase().includes(q)).slice(0,8)},[query,state,onNavigate,apiData])
  const choose=(item:typeof results[number])=>{item.go();setQuery('');setSearchOpen(false)}
  const connectionLabel = connection === 'connected' ? 'Connected' : connection === 'error' ? 'Offline' : 'Checking'
  const lastRefreshLabel = lastRefresh
    ? `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(lastRefresh))} IST`
    : 'Not yet refreshed'
  return <header className="topbar">
    <div className="page-heading"><p className="eyebrow">HQ OPERATIONS</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>
    <div className="topbar-tools">
      <div className="global-search-wrap"><input className="text-input global-search" value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQuery(e.target.value);setSearchOpen(true)}} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);if(e.key==='Enter'&&results[0])choose(results[0])}} placeholder="Search assets, cargo, people…" aria-label="Search operational records" />{searchOpen&&query&&<div className="global-search-results" role="listbox">{results.length?results.map((item,index)=><button type="button" role="option" key={`${item.type}-${index}`} onClick={()=>choose(item)}><small>{item.type}</small><span>{item.label}</span></button>):<p>No matching operational records.</p>}</div>}</div>
      <PolarClock />
      <div className="connection-summary" role="status" aria-label={`API connectivity: ${connectionLabel}`}><span>API connectivity</span><StatusPill status={connectionLabel} /></div>
      <button type="button" className="btn-secondary" aria-label={`Open notifications, ${state.notifications.filter(item=>!item.read).length} unread demo notifications`} onClick={()=>{demoOperationsStore.markNotificationsRead();onNavigate('demo-history')}}>Notifications{state.notifications.some(item=>!item.read)?` · ${state.notifications.filter(item=>!item.read).length} new`:''}</button>
      <div className="refresh-meta"><span>Last refresh</span><strong>{lastRefreshLabel}</strong></div>
      <button type="button" className="btn-secondary" onClick={onRefresh} disabled={isRefreshing}>{isRefreshing ? 'Refreshing…' : 'Refresh data'}</button>
      <button type="button" className="btn-secondary" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
      <div className="user-summary"><strong>{recordLabel(user.full_name, user.employee_code || user.email, 'Authenticated user')}</strong><span>{recordLabel(user.role, null, 'Role unavailable')}{user.scope ? ` · ${user.scope}` : ''}</span></div>
      <button type="button" className="btn-logout" onClick={onLogout}>Sign out</button>
    </div>
  </header>
}
