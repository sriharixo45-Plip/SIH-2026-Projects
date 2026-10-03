import { POLAR_STATION_REFERENCES } from '../data/polar-stations'

export type Geo = { lat: number; lon: number }
export type OperationalStatus = 'IN TRANSIT' | 'PLANNED' | 'ARRIVED' | 'DELAYED' | 'EXCEPTION'
export type DemoAsset = {
  id: string; kind: 'ship' | 'flight'; name: string; registration: string; status: OperationalStatus
  position: Geo; route: Geo[]; history: { point: Geo; at: string }[]; speed: number; heading: number
  altitude?: number; origin: string; destination: string; nextWaypoint: string; eta: string
  operationId: string; cargoIds: string[]; lastUpdate: string; progress: number; crew?: number
  vesselType?:string; imo?:string; mmsi?:string; aircraft?:string; cargoWeightKg:number
  capacityWeightKg:number
}
export type DemoCargo = {
  id: string; mode: 'ship' | 'air'; assetId: string; operationId: string; base: string; description: string
  origin?:string;destination?:string
  category: string; weightKg: number; volumeM3: number; packages: number; priority: 'Routine' | 'Priority' | 'Critical'
  status: string; eta: string; returnCargo?: boolean
  lastUpdate?:string
  exception?:string
  attributes?:string[];temperatureRequirement?:string;hazardous?:boolean;transitLocation?:string;voyage?:string
}
export const cargoCategories=['Scientific Equipment','Research Samples','Food & Provisions','Fuel','Medical Supplies','Machinery','Spare Parts','Communication Equipment','Power Equipment','Emergency Supplies','Return Cargo']

export const demoBases = [
  { id: 'NCPOR', name: POLAR_STATION_REFERENCES.ncpor.name, region: POLAR_STATION_REFERENCES.ncpor.region, point: { lat: POLAR_STATION_REFERENCES.ncpor.point.latitude, lon: POLAR_STATION_REFERENCES.ncpor.point.longitude } },
  { id: 'MAITRI', name: POLAR_STATION_REFERENCES.maitri.name, region: 'Queen Maud Land', point: { lat: POLAR_STATION_REFERENCES.maitri.point.latitude, lon: POLAR_STATION_REFERENCES.maitri.point.longitude } },
  { id: 'BHARATI', name: POLAR_STATION_REFERENCES.bharati.name, region: 'Larsemann Hills', point: { lat: POLAR_STATION_REFERENCES.bharati.point.latitude, lon: POLAR_STATION_REFERENCES.bharati.point.longitude } },
  { id: 'HIMADRI', name: POLAR_STATION_REFERENCES.himadri.name, region: POLAR_STATION_REFERENCES.himadri.region, point: { lat: POLAR_STATION_REFERENCES.himadri.point.latitude, lon: POLAR_STATION_REFERENCES.himadri.point.longitude } },
]

export const demoOperations = [
  { id: 'OPS-2601', name: 'Bharati Resupply', type: 'Resupply', status: 'IN TRANSIT', start: '2026-09-24', deadline: '2026-10-18', origin: 'Cape Town', destination: 'Bharati', currentLocation: 'Southern Ocean', requiredPersonnel: 42, requiredCargoTonnes: 8.4, requiredRoles:['Polar Medic','Research Scientist','Logistics Officer','Communications Specialist','Marine Technician'],personnelIds: ['EMP-D001','EMP-D002','EMP-D003','EMP-D004','EMP-D005'], assetIds: ['POLAR-014','FLIGHT-021'], cargoIds: ['CG-S-014','CG-A-021'], incidentIds: ['INC-DEMO-2606'], timeline: ['PLANNED','PERSONNEL ASSIGNED','ASSET ASSIGNED','CARGO LOADED','DEPARTED','IN TRANSIT'] },
  { id: 'OPS-2602', name: 'Maitri Science Rotation', type: 'Personnel Rotation', status: 'PLANNED', start: '2026-10-11', deadline: '2026-11-02', origin: 'Cape Town', destination: 'Maitri', currentLocation: 'Cape Town', requiredPersonnel: 12, requiredCargoTonnes: 2.2, personnelIds: Array.from({length:12},(_,index)=>`EMP-D${String(index+43).padStart(3,'0')}`), assetIds: ['POLAR-018','FLIGHT-024'], cargoIds: ['CG-S-018','CG-A-024'], incidentIds: [], timeline: ['PLANNED'] },
]
export type DemoIncident={id:string;operationId:string;base:string;type:string;severity:string;status:string;syncStatus?:'DRAFT'|'PENDING SYNC'|'SYNCING'|'SYNCED'|'SYNC FAILED';description:string;point:Geo;at:string}
export const demoIncidents:DemoIncident[]=[{id:'INC-DEMO-2606',operationId:'OPS-2601',base:'BHARATI',type:'Weather advisory',severity:'MODERATE',status:'EXCEPTION',description:'Illustrative crosswind advisory on the final approach window. Route monitoring required.',point:{lat:-62.4,lon:52.1},at:'2026-10-02T04:30:00Z'}]

const seaRoute: Geo[] = [
  { lat: -34.0, lon: 18.4 }, { lat: -43.5, lon: 23.0 }, { lat: -52.0, lon: 31.0 },
  { lat: -58.0, lon: 38.0 }, { lat: -62.5, lon: 51.0 }, { lat: -66.2, lon: 66.0 }, { lat: POLAR_STATION_REFERENCES.bharati.point.latitude, lon: POLAR_STATION_REFERENCES.bharati.point.longitude },
]
const airRoute: Geo[] = [
  { lat: -33.97, lon: 18.60 }, { lat: -45.0, lon: 28.0 }, { lat: -55.0, lon: 41.0 },
  { lat: -63.0, lon: 57.0 }, { lat: POLAR_STATION_REFERENCES.bharati.point.latitude, lon: POLAR_STATION_REFERENCES.bharati.point.longitude },
]
function routeHistory(route: Geo[], progress: number) {
  return route.slice(0, Math.max(2, Math.ceil(route.length * progress))).map((point, index) => ({ point, at: new Date(Date.now() - (route.length - index) * 3_600_000).toISOString() }))
}
function interpolate(route: Geo[], progress: number): Geo {
  const scaled = progress * (route.length - 1), index = Math.min(Math.floor(scaled), route.length - 2), t = scaled - index
  return { lat: route[index].lat + (route[index + 1].lat - route[index].lat) * t, lon: route[index].lon + (route[index + 1].lon - route[index].lon) * t }
}
const shipProgress = .58, flightProgress = .46
export const initialDemoAssets: DemoAsset[] = [
  { id: 'POLAR-014', kind: 'ship', name: 'POLAR-014 · Sagar Nidhi', registration: 'Sagar Nidhi', imo:'9283901',mmsi:'419000014',vesselType:'Polar research and supply vessel',status: 'IN TRANSIT', route: seaRoute, position: interpolate(seaRoute, shipProgress), history: routeHistory(seaRoute, shipProgress), speed: 14.2, heading: 142, origin: 'Cape Town', destination: 'Bharati', nextWaypoint: 'Antarctic convergence', eta: '2026-10-07T12:00:00Z', operationId: 'OPS-2601', cargoIds: ['CG-S-014'], cargoWeightKg:5100,capacityWeightKg:54000,lastUpdate: new Date().toISOString(), progress: shipProgress },
  { id: 'POLAR-018', kind: 'ship', name: 'POLAR-018 · Samudra', registration: 'Samudra',imo:'9418206',mmsi:'419000018',vesselType:'Polar research and supply vessel', status: 'PLANNED', route: seaRoute.map(p => ({ ...p, lon: p.lon - 13 })), position: { ...seaRoute[0], lon: seaRoute[0].lon - 13 }, history: [], speed: 0, heading: 0, origin: 'Cape Town', destination: 'Maitri', nextWaypoint: 'Departure port', eta: '2026-10-29T09:00:00Z', operationId: 'OPS-2602', cargoIds: ['CG-S-018'],cargoWeightKg:2600,capacityWeightKg:54000,lastUpdate: new Date().toISOString(), progress: 0 },
  { id: 'FLIGHT-021', kind: 'flight', name: 'FLIGHT-021 · Antarctic Link', registration: 'VT-PLR', aircraft:'C-130J Hercules', status: 'IN TRANSIT', route: airRoute, position: interpolate(airRoute, flightProgress), history: routeHistory(airRoute, flightProgress), speed: 420, heading: 154, altitude: 6100, origin: 'Cape Town', destination: 'Bharati', nextWaypoint: 'S 63° 00′ · E 57° 00′', eta: '2026-10-03T16:40:00Z', operationId: 'OPS-2601', cargoIds: ['CG-A-021','CG-A-026'],cargoWeightKg:1900,capacityWeightKg:4000,lastUpdate: new Date().toISOString(), progress: flightProgress, crew: 8 },
  { id: 'FLIGHT-024', kind: 'flight', name: 'FLIGHT-024 · Maitri Rotation', registration: 'VT-HIM',aircraft:'Basler BT-67', status: 'PLANNED', route: airRoute.map(p => ({ ...p, lon: p.lon - 13 })), position: { ...airRoute[0], lon: airRoute[0].lon - 13 }, history: [], speed: 0, heading: 0, altitude: 0, origin: 'Cape Town', destination: 'Maitri', nextWaypoint: 'Departure port', eta: '2026-10-27T14:00:00Z', operationId: 'OPS-2602', cargoIds: ['CG-A-024'],cargoWeightKg:800,capacityWeightKg:2000,lastUpdate: new Date().toISOString(), progress: 0, crew: 6 },
]

export const demoCargo: DemoCargo[] = [
  { id:'CG-S-014', mode:'ship', assetId:'POLAR-014', operationId:'OPS-2601', base:'BHARATI', description:'Generator spares & scientific systems', category:'Spare Parts', weightKg:5100, volumeM3:18.4, packages:42, priority:'Critical', status:'IN TRANSIT', eta:'2026-10-07T12:00:00Z', voyage:'Sagar Nidhi · Voyage 26-04',transitLocation:'Southern Ocean · 58°S',attributes:['Fragile','Oversized','Special Handling'] },
  { id:'CG-A-021', mode:'air', assetId:'FLIGHT-021', operationId:'OPS-2601', base:'BHARATI', description:'Medical and emergency supplies', category:'Medical Supplies', weightKg:1300, volumeM3:6.8, packages:16, priority:'Critical', status:'IN TRANSIT', eta:'2026-10-03T16:40:00Z',transitLocation:'En route to Antarctic sector',temperatureRequirement:'Ambient',attributes:['Priority handling'] },
  { id:'CG-A-026', mode:'air', assetId:'FLIGHT-021', operationId:'OPS-2601', base:'BHARATI', description:'Cold-chain research samples · weather hold', category:'Research Samples', weightKg:600, volumeM3:2.4, packages:4, priority:'Priority', status:'DELAYED', eta:'2026-10-04T10:00:00Z', exception:'Weather delay · transfer pending',temperatureRequirement:'2–8 °C',attributes:['Temperature Controlled','Scientific Sample','Fragile'] },
  { id:'CG-S-018', mode:'ship', assetId:'POLAR-018', operationId:'OPS-2602', base:'MAITRI', description:'Field research and shelter equipment', category:'Scientific Equipment', weightKg:2600, volumeM3:12, packages:28, priority:'Priority', status:'APPROVED', eta:'2026-10-29T09:00:00Z',voyage:'Samudra · Voyage 26-05',attributes:['Oversized','Special Handling'] },
  { id:'CG-A-024', mode:'air', assetId:'FLIGHT-024', operationId:'OPS-2602', base:'MAITRI', description:'Research samples and communications kit', category:'Communication Equipment', weightKg:800, volumeM3:4.2, packages:9, priority:'Priority', status:'PACKED', eta:'2026-10-27T14:00:00Z',temperatureRequirement:'2–8 °C',attributes:['Scientific Sample','Fragile'] },
  { id:'CG-RET-006', mode:'ship', assetId:'POLAR-018', operationId:'OPS-2602', base:'NCPOR', origin:'Maitri',destination:'NCPOR / India', description:'Seasonal research samples · return cargo', category:'Return Cargo', weightKg:460, volumeM3:3.5, packages:11, priority:'Routine', status:'REQUESTED', eta:'2026-11-05T09:00:00Z', returnCargo:true,voyage:'Samudra · Return Voyage 26-05',attributes:['Return Cargo','Scientific Sample','Temperature Controlled'] },
]

export const initialDemoEmployees = Array.from({ length: 54 }, (_, i) => ({
  id: `EMP-D${String(i + 1).padStart(3,'0')}`, name: ['Aarav Menon','Ananya Rao','Ishaan Das','Meera Iyer','Kabir Nair','Rhea Sen'][i % 6], role: i>=37&&i<42?['Polar Medic','Research Scientist','Logistics Officer','Communications Specialist','Marine Technician'][i-37]:['Field Engineer','Polar Medic','Research Scientist','Logistics Officer','Communications Specialist','Marine Technician'][i % 6], mainBase:'NCPOR', base:i>=42?'MAITRI':i>=37?'BHARATI':['BHARATI','MAITRI','HIMADRI','BHARATI'][i % 4], region:i>=42?'Queen Maud Land':i>=37?'Larsemann Hills':['Larsemann Hills','Queen Maud Land','Svalbard'][i % 3], shift:['A','B','C'][i % 3], shiftDeadline:'2026-10-12T18:00:00Z', operationId:i < 37 ? 'OPS-2601' : i>=42?'OPS-2602':undefined, assetId:i < 30 ? 'POLAR-014' : i>=42?i%2?'POLAR-018':'FLIGHT-024':undefined, status:i < 37||i>=42 ? 'ON OPERATION' : 'AVAILABLE', availability:i < 37||i>=42 ? 'ASSIGNED' : 'AVAILABLE', deployment:'2026-09-20 — 2027-02-14',
}))

const inventoryProfiles=[
  {base:'BHARATI',values:[31,68,24,74,57,82]},
  {base:'MAITRI',values:[46,72,61,66,58,79]},
  {base:'HIMADRI',values:[64,81,73,78,69,86]},
  {base:'NCPOR',values:[78,83,77,81,75,88]},
]
const inventoryItems=['Fuel','Medical supplies','Generator spares','Food provisions','Scientific equipment','Emergency supplies']
export const demoInventory=inventoryProfiles.flatMap(profile=>inventoryItems.map((item,index)=>({base:profile.base,item,quantity:profile.values[index],unit:'%'})))
