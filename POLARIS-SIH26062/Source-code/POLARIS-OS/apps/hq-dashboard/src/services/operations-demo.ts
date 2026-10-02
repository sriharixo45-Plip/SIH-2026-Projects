import { demoBases, demoCargo, demoIncidents, demoInventory, demoOperations, initialDemoAssets, initialDemoEmployees } from '../mock-data/operations'
import type { DemoAsset, DemoCargo, DemoIncident } from '../mock-data/operations'

export type DemoNotification = { id:string; text:string; at:string; read:boolean }
export type DemoAudit = { id:string; actor:string; action:string; entity:string; before:string; after:string; at:string }
export type DemoSyncRow={id:string;status:'DRAFT'|'PENDING SYNC'|'SYNCING'|'SYNCED'|'SYNC FAILED';description:string;at:string}
export type DemoScheduleRequest={id:string;employeeId:string;currentShift:string;requestedShift:string;requestedDate:string;reason:string;comments:string;status:'PENDING APPROVAL'|'APPROVED'|'REJECTED';createdAt:string;decidedAt?:string;actor:string;approver?:string}
export type DemoRecommendation = { id:string; status:'PENDING APPROVAL'|'APPROVED'|'REJECTED'|'MODIFICATION REQUESTED'; generatedAt:string; operationId:string; coverageBefore:number; coverageAfter:number; cargoBefore:number; cargoAfter:number; proposedCargoKg:number; employeeIds:string[]; cargoId:string; reason:string; explanation:string; decidedAt?:string; decidedBy?:string }
export type DemoState = { assets:DemoAsset[]; cargo:DemoCargo[]; employees:typeof initialDemoEmployees; operations:typeof demoOperations; incidents:DemoIncident[]; inventory:typeof demoInventory; notifications:DemoNotification[]; audit:DemoAudit[]; recommendations:DemoRecommendation[]; scheduleRequests:DemoScheduleRequest[]; syncQueue:DemoSyncRow[]; lastSyncAt:string|null }
const syncAssetManifest=(state:DemoState,assetId:string)=>{const asset=state.assets.find(item=>item.id===assetId);if(!asset)return;const linked=state.cargo.filter(item=>item.assetId===assetId&&!['RECEIVED','DELIVERED'].includes(item.status));const onboard=linked.filter(item=>['LOADED','DISPATCHED','IN TRANSIT','DELAYED','ARRIVED'].includes(item.status));asset.cargoIds=linked.map(item=>item.id);asset.cargoWeightKg=onboard.reduce((total,item)=>total+item.weightKg,0)}
const inventoryKeyForCategory=(category:string)=>category.includes('Medical')?'medical':category==='Fuel'?'fuel':category==='Spare Parts'?'spare':category.includes('Food')?'food':category.includes('Emergency')?'emergency':'scientific'
const KEY='polaris_ops_demo_v1'
const fresh=():DemoState=>{const cargo=structuredClone(demoCargo),now=new Date().toISOString();cargo.forEach(item=>item.lastUpdate=now);return {assets:structuredClone(initialDemoAssets),cargo,employees:structuredClone(initialDemoEmployees),operations:structuredClone(demoOperations),incidents:structuredClone(demoIncidents),inventory:structuredClone(demoInventory),notifications:[],audit:[],recommendations:[],scheduleRequests:[],syncQueue:[{id:'FIELD-INC-0402',status:'PENDING SYNC',description:'Weather delay at Bharati approach',at:now},{id:'FIELD-INC-0401',status:'SYNC FAILED',description:'Field safety report ? retry available',at:new Date(Date.now()-3600_000).toISOString()},{id:'FIELD-INC-0398',status:'SYNCED',description:'Cargo receipt confirmation',at:new Date(Date.now()-7200_000).toISOString()}],lastSyncAt:new Date(Date.now()-2*3600_000).toISOString()}}
let snapshot:DemoState | null=null
const listeners=new Set<()=>void>()
function read():DemoState { if(snapshot) return snapshot; try { const raw=localStorage.getItem(KEY); snapshot=raw?JSON.parse(raw) as DemoState:fresh() } catch { snapshot=fresh() } snapshot!.scheduleRequests??=[];for(const cargo of snapshot!.cargo)cargo.lastUpdate??=new Date().toISOString();for(const asset of snapshot!.assets)syncAssetManifest(snapshot!,asset.id);const roleSeed=['Polar Medic','Research Scientist','Logistics Officer','Communications Specialist','Marine Technician'];for(let i=0;i<roleSeed.length;i++){const person=snapshot!.employees.find(item=>item.id===`EMP-D${String(i+38).padStart(3,'0')}`);if(person&&!person.operationId&&person.availability==='AVAILABLE'&&person.base==='BHARATI')person.role=roleSeed[i]}return snapshot! }
function write(next:DemoState) { snapshot=next; try { localStorage.setItem(KEY,JSON.stringify(next)) } catch { /* The in-memory demo remains usable when storage is unavailable. */ } listeners.forEach(listener=>listener()) }
export const demoOperationsStore={
  getState:read,
  subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener)},
  markNotificationsRead(){const s=read();if(!s.notifications.some(item=>!item.read))return;s.notifications=s.notifications.map(item=>item.read?item:{...item,read:true});write({...s})},
  createScheduleRequest(employeeId:string,requestedShift:string,requestedDate:string,reason:string,comments:string,actor:string){const s=read(),person=s.employees.find(item=>item.id===employeeId);if(!person)throw new Error('Select a personnel record.');if(!['A','B','C'].includes(requestedShift)||requestedShift===person.shift)throw new Error('Choose a different valid shift.');if(!requestedDate||Number.isNaN(Date.parse(requestedDate))||requestedDate<new Date().toISOString().slice(0,10))throw new Error('Choose a valid date that is today or later.');if(!reason.trim())throw new Error('Provide a reason for the schedule change.');const at=new Date().toISOString(),request:DemoScheduleRequest={id:`SCH-${Date.now()}`,employeeId,currentShift:person.shift,requestedShift,requestedDate,reason:reason.trim(),comments:comments.trim(),status:'PENDING APPROVAL',createdAt:at,actor};s.scheduleRequests.unshift(request);s.notifications.unshift({id:`N-${Date.now()}`,text:`Schedule change request ${request.id} requires supervisor review for ${person.name}.`,at,read:false});s.audit.unshift({id:`AUD-${Date.now()}`,actor,action:'Schedule change requested',entity:request.id,before:`Shift ${person.shift}`,after:`Shift ${requestedShift} on ${requestedDate}`,at});write({...s});return request.id},
  decideScheduleRequest(id:string,decision:'APPROVED'|'REJECTED',approver:string){const s=read(),request=s.scheduleRequests.find(item=>item.id===id);if(!request||request.status!=='PENDING APPROVAL')throw new Error('This schedule request is no longer pending.');const person=s.employees.find(item=>item.id===request.employeeId);if(!person)throw new Error('The personnel record no longer exists.');const at=new Date().toISOString(),before=`Shift ${person.shift}`;request.status=decision;request.approver=approver;request.decidedAt=at;if(decision==='APPROVED'){person.shift=request.requestedShift;person.shiftDeadline=`${request.requestedDate}T18:00:00.000Z`}s.notifications.unshift({id:`N-${Date.now()}`,text:decision==='APPROVED'?`Schedule change ${request.id} approved for ${person.name}; employee record updated.`:`Schedule change ${request.id} rejected for ${person.name}.`,at,read:false});s.audit.unshift({id:`AUD-${Date.now()}`,actor:approver,action:`Schedule change ${decision.toLowerCase()}`,entity:request.id,before,after:decision==='APPROVED'?`Shift ${request.requestedShift} on ${request.requestedDate}`:before,at});write({...s})},
  advanceOperation(operationId:string,actor:string){
    const s=read(),op=s.operations.find(x=>x.id===operationId);if(!op)throw new Error('Operation not found.')
    const stages=['PLANNED','PERSONNEL ASSIGNED','ASSET ASSIGNED','CARGO LOADED','DEPARTED','IN TRANSIT','ARRIVED','COMPLETED']
    const current=Math.max(0,stages.indexOf(op.status));const next=stages[current+1]
    if(!next)throw new Error('This operation is already complete.')
    const assignedPeople=s.employees.filter(person=>person.operationId===operationId)
    const operationAssets=s.assets.filter(asset=>asset.operationId===operationId)
    const outboundCargo=s.cargo.filter(item=>item.operationId===operationId&&!item.returnCargo&&(item.origin??op.origin)===op.origin)
    if(next==='PERSONNEL ASSIGNED'&&assignedPeople.length<op.requiredPersonnel)throw new Error(`Personnel requirement is not met: ${assignedPeople.length}/${op.requiredPersonnel} assigned.`)
    if(next==='ASSET ASSIGNED'&&!operationAssets.length)throw new Error('Assign a ship or flight before advancing this operation.')
    if(next==='CARGO LOADED'){
      const eligible=outboundCargo.filter(item=>['APPROVED','PACKED','INSPECTED','REQUESTED','LOADED'].includes(item.status))
      const cargoKg=eligible.reduce((total,item)=>total+item.weightKg,0)
      if(cargoKg<op.requiredCargoTonnes*1000)throw new Error(`Outbound cargo requirement is not met: ${(cargoKg/1000).toFixed(1)}/${op.requiredCargoTonnes.toFixed(1)} tonnes.`)
    }
    if(next==='DEPARTED'&&!outboundCargo.some(item=>item.status==='LOADED'))throw new Error('Load outbound cargo before departure.')
    const before=op.status,at=new Date().toISOString();op.timeline=Array.from(new Set([...op.timeline,next]));op.status=next
    if(next==='PERSONNEL ASSIGNED')for(const person of s.employees.filter(e=>e.operationId===operationId)){person.status='ON OPERATION';person.availability='ASSIGNED';op.personnelIds=Array.from(new Set([...(op.personnelIds as string[]),person.id]))}
    if(next==='ASSET ASSIGNED'){const assetId=(op.assetIds as string[])[0];for(const person of s.employees.filter(e=>e.operationId===operationId&&!e.assetId))person.assetId=assetId}
    if(next==='CARGO LOADED')for(const cargo of s.cargo.filter(c=>c.operationId===operationId&&!c.returnCargo&&(c.origin??op.origin)===op.origin&&['APPROVED','PACKED','INSPECTED','REQUESTED'].includes(c.status)))cargo.status='LOADED'
    if(next==='DEPARTED'||next==='IN TRANSIT')for(const asset of s.assets.filter(a=>a.operationId===operationId)){asset.status='IN TRANSIT';if(asset.progress===0)asset.progress=.02;asset.lastUpdate=at}
    if(next==='ARRIVED'){
      for(const asset of s.assets.filter(a=>a.operationId===operationId)){asset.status='ARRIVED';asset.progress=1;asset.position={...asset.route[asset.route.length-1]};asset.lastUpdate=at}
      for(const cargo of s.cargo.filter(c=>c.operationId===operationId&&['LOADED','DISPATCHED','IN TRANSIT'].includes(c.status)))cargo.status='ARRIVED';op.currentLocation=op.destination
    }
    if(next==='COMPLETED')for(const cargo of s.cargo.filter(c=>c.operationId===operationId&&['ARRIVED','UNLOADED'].includes(c.status))){cargo.status='RECEIVED';const key=inventoryKeyForCategory(cargo.category);const inventory=s.inventory.find(item=>item.base===cargo.base&&item.item.toLowerCase().includes(key));if(inventory){const previous=inventory.quantity;inventory.quantity=Math.min(100,Number(inventory.quantity)+(cargo.weightKg>=1000?8:3));s.audit.unshift({id:`AUD-${Date.now()}-INV`,actor,action:'Inventory updated on operation completion',entity:`${cargo.base} / ${inventory.item}`,before:`${previous}${inventory.unit}`,after:`${inventory.quantity}${inventory.unit}`,at});s.notifications.unshift({id:`N-${Date.now()}-INV`,text:`${inventory.item} stock reconciled at ${cargo.base} after operation completion.`,at,read:false})}}
    for(const asset of s.assets.filter(item=>item.operationId===operationId))syncAssetManifest(s,asset.id)
    s.audit.unshift({id:`AUD-${Date.now()}`,actor,action:'Operation lifecycle advanced',entity:operationId,before,after:next,at})
    s.notifications.unshift({id:`N-${Date.now()}`,text:`${op.name} advanced to ${next}.`,at,read:false})
    write({...s});return next
  },
  updatePosition(assetId:string){const s=read(), asset=s.assets.find(x=>x.id===assetId); if(!asset||asset.status!=='IN TRANSIT')return;const oldSegment=Math.floor(asset.progress*(asset.route.length-1));const progress=Math.min(1,asset.progress+.0018);const scaled=progress*(asset.route.length-1),index=Math.min(Math.floor(scaled),asset.route.length-2),t=scaled-index;asset.position={lat:asset.route[index].lat+(asset.route[index+1].lat-asset.route[index].lat)*t,lon:asset.route[index].lon+(asset.route[index+1].lon-asset.route[index].lon)*t};const a=asset.route[index],b=asset.route[index+1];asset.heading=(Math.round((Math.atan2(Math.sin((b.lon-a.lon)*Math.PI/180)*Math.cos(b.lat*Math.PI/180),Math.cos(a.lat*Math.PI/180)*Math.sin(b.lat*Math.PI/180)-Math.sin(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.cos((b.lon-a.lon)*Math.PI/180))*180/Math.PI)+360)%360);asset.progress=progress;const nominalSpeed=asset.kind==='ship'?14.2:420;const speedVariation=Math.sin(Date.now()/60000+asset.progress*10)*(asset.kind==='ship'?0.4:18);asset.speed=Math.round((nominalSpeed+speedVariation)*10)/10;asset.lastUpdate=new Date().toISOString();asset.eta=new Date(Date.now()+Math.max(0,(1-progress)*(asset.kind==='ship'?96:8))*3600_000).toISOString();asset.history=[...asset.history,{point:{...asset.position},at:asset.lastUpdate}].slice(-100);const segment=Math.floor(progress*(asset.route.length-1));if(segment>oldSegment){const message=`${asset.id} demo movement update · next waypoint segment ${segment+1}`;s.notifications.unshift({id:`N-${Date.now()}`,text:message,at:asset.lastUpdate,read:false})}if(progress>=1){asset.status='ARRIVED';s.notifications.unshift({id:`N-${Date.now()}`,text:`${asset.id} demo route simulation reached ${asset.destination}.`,at:asset.lastUpdate,read:false})}write({...s})},
  generateRecommendation():DemoRecommendation {
    const s=read(),op=s.operations.find(item=>item.id==='OPS-2601')
    if(!op)throw new Error('Bharati Resupply demo operation is unavailable.')
    const assigned=s.employees.filter(person=>person.operationId===op.id).length
    const shortage=Math.max(0,op.requiredPersonnel-assigned)
    const candidates=s.employees.filter(person=>!person.operationId&&person.availability==='AVAILABLE'&&person.base==='BHARATI'&&(op.requiredRoles??[]).includes(person.role)&&Date.parse(person.shiftDeadline)>Date.now()&&Date.parse(person.deployment.slice(-10))>Date.now())
    const employeeIds=Date.parse(op.deadline)>Date.now()?candidates.slice(0,shortage).map(person=>person.id):[]
    const coveredStatuses=['LOADED','DISPATCHED','IN TRANSIT','DELAYED','ARRIVED','UNLOADED','RECEIVED']
    const shipCargoKg=s.cargo.filter(item=>item.operationId===op.id&&item.mode==='ship'&&coveredStatuses.includes(item.status)).reduce((total,item)=>total+item.weightKg,0)
    const cargoBefore=shipCargoKg/1000
    const cargoId='CG-S-015'
    const existingLine=s.cargo.find(item=>item.id===cargoId)
    const proposalAlreadyCovered=!!existingLine&&coveredStatuses.includes(existingLine.status)
    const cargoGapKg=Math.max(0,op.requiredCargoTonnes*1000-shipCargoKg)
    const proposedCargoKg=proposalAlreadyCovered?0:existingLine?Math.min(existingLine.weightKg,cargoGapKg):Math.min(3300,cargoGapKg)
    const ship=s.assets.find(asset=>asset.id==='POLAR-014')
    const shipCapacity=ship?.capacityWeightKg??54000
    const shipOnboardKg=s.cargo.filter(item=>item.assetId==='POLAR-014'&&['LOADED','DISPATCHED','IN TRANSIT','DELAYED','ARRIVED'].includes(item.status)).reduce((total,item)=>total+item.weightKg,0)
    const flight=s.assets.find(asset=>asset.id==='FLIGHT-021')
    const airCargoKg=s.cargo.filter(item=>item.operationId===op.id&&item.mode==='air'&&['LOADED','DISPATCHED','IN TRANSIT','DELAYED','ARRIVED','UNLOADED','RECEIVED'].includes(item.status)).reduce((total,item)=>total+item.weightKg,0)
    const flightFits=airCargoKg<=(flight?.capacityWeightKg??4000)
    const canCarry=shipOnboardKg+proposedCargoKg<=shipCapacity
    const cargoAfter=cargoBefore+(canCarry?proposedCargoKg/1000:0)
    const fuel=s.inventory.find(item=>item.base==='BHARATI'&&item.item==='Fuel')
    const activeIncidents=s.incidents.filter(item=>item.operationId===op.id&&!['RESOLVED','CLOSED'].includes(item.status))
    const rec:DemoRecommendation={
      id:`REC-${Date.now()}`,status:'PENDING APPROVAL',generatedAt:new Date().toISOString(),operationId:op.id,
      coverageBefore:assigned,coverageAfter:assigned+employeeIds.length,cargoBefore,cargoAfter,proposedCargoKg,employeeIds,cargoId,
      reason:`${shortage} personnel gap; ${Math.max(0,op.requiredCargoTonnes-cargoBefore).toFixed(1)} t cargo gap; Bharati fuel stock at ${fuel?.quantity??'unknown'}%. ${employeeIds.length} available candidates pass role, base, shift and deployment checks; proposed ship cargo ${proposedCargoKg.toLocaleString()} kg; ship capacity ${canCarry?'passes':'fails'} (${(shipCapacity/1000).toFixed(1)} t); aircraft cargo capacity ${flightFits?'passes':'fails'} (${(flight?.capacityWeightKg??4000)/1000} t capacity for ${ (airCargoKg/1000).toFixed(1)} t linked air cargo); operation deadline ${Date.parse(op.deadline)>Date.now()?'is open':'has passed'}; ${activeIncidents.length} active incident(s) require review.`,
      explanation:`Bharati Resupply currently has ${assigned} of ${op.requiredPersonnel} required personnel. ${employeeIds.length} available demo personnel satisfy the role, base, shift and deployment checks and are proposed for assignment. Recorded ship cargo is ${cargoBefore.toFixed(1)} t against ${op.requiredCargoTonnes.toFixed(1)} t required; ${proposedCargoKg?`${(proposedCargoKg/1000).toFixed(1)} t of additional ship cargo is proposed`:'the proposed manifest line is already covered by current cargo records'}. Proposed ship cargo fits the ${(shipCapacity/1000).toFixed(1)} t vessel limit: ${canCarry?'yes':'no'}. Linked aircraft carries ${(airCargoKg/1000).toFixed(1)} t against ${(flight?.capacityWeightKg??4000)/1000} t capacity: ${flightFits?'within capacity':'over capacity'}. Bharati fuel stock is ${fuel?.quantity??'unknown'}%. ${activeIncidents.length} active incident(s) are included in the risk review. Supervisor approval is required before any proposed changes are implemented.`
    }
    s.recommendations.unshift(rec)
    s.notifications.unshift({id:`N-${Date.now()}`,text:`AI recommendation requires review for ${op.name}.`,at:rec.generatedAt,read:false})
    write({...s})
    return rec
  },
  decide(id:string,decision:'APPROVED'|'REJECTED'|'MODIFICATION REQUESTED',actor:string){
    const s=read(),rec=s.recommendations.find(item=>item.id===id)
    if(!rec||rec.status!=='PENDING APPROVAL')throw new Error('This recommendation is no longer pending.')
    const op=s.operations.find(item=>item.id===rec.operationId)
    if(!op)throw new Error('The recommendation operation no longer exists.')
    const at=new Date().toISOString()
    const assignedNow:string[]=[]
    let cargoAddedKg=0
    if(decision==='APPROVED'){
      for(const employeeId of rec.employeeIds){
        const person=s.employees.find(item=>item.id===employeeId)
        if(!person||person.operationId||person.availability!=='AVAILABLE'||person.base!=='BHARATI'||!(op.requiredRoles??[]).includes(person.role)||Date.parse(person.shiftDeadline)<=Date.now()||Date.parse(person.deployment.slice(-10))<=Date.now()||Date.parse(op.deadline)<=Date.now())continue
        person.operationId=op.id;person.assetId='POLAR-014';person.status='ON OPERATION';person.availability='ASSIGNED'
        assignedNow.push(person.id)
        op.personnelIds=Array.from(new Set([...(op.personnelIds as string[]),person.id]))
        s.audit.unshift({id:`AUD-${Date.now()}-${person.id}`,actor,action:'Personnel assignment changed',entity:person.id,before:'AVAILABLE',after:`ASSIGNED to ${op.id}`,at})
      }
      if(rec.proposedCargoKg>0){
        let cargo=s.cargo.find(item=>item.id===rec.cargoId)
        const ship=s.assets.find(asset=>asset.id==='POLAR-014')
        const onboardKg=s.cargo.filter(item=>item.assetId==='POLAR-014'&&['LOADED','DISPATCHED','IN TRANSIT','DELAYED','ARRIVED'].includes(item.status)).reduce((total,item)=>total+item.weightKg,0)
        const cargoFits=Date.parse(op.deadline)>Date.now()&&!!ship&&onboardKg+rec.proposedCargoKg<=ship.capacityWeightKg
        if(cargoFits){
          if(!cargo){cargo={id:rec.cargoId,mode:'ship',assetId:'POLAR-014',operationId:op.id,base:'BHARATI',origin:'Cape Town',destination:'Bharati',description:'Fuel reserve and generator spares',category:'Fuel',weightKg:rec.proposedCargoKg,volumeM3:Math.round(rec.proposedCargoKg/330*100)/100,packages:Math.max(1,Math.ceil(rec.proposedCargoKg/157)),priority:'Critical',status:'IN TRANSIT',eta:ship.eta??op.deadline,lastUpdate:at};s.cargo.unshift(cargo)}
          else{cargo.weightKg=rec.proposedCargoKg;cargo.volumeM3=Math.round(rec.proposedCargoKg/330*100)/100;cargo.packages=Math.max(1,Math.ceil(rec.proposedCargoKg/157))}
          cargo.status='IN TRANSIT';cargo.lastUpdate=at;cargoAddedKg=cargo.weightKg
          op.cargoIds=Array.from(new Set([...(op.cargoIds as string[]),cargo.id]))
          syncAssetManifest(s,cargo.assetId)
          s.notifications.unshift({id:`N-${Date.now()}-C`,text:`${(cargoAddedKg/1000).toFixed(1)} t of cargo assigned to ${op.name}.`,at,read:false})
          s.audit.unshift({id:`AUD-${Date.now()}-C`,actor,action:'Cargo manifest updated',entity:cargo.id,before:`${rec.cargoBefore.toFixed(1)} t at recommendation time`,after:`${(rec.cargoBefore+cargoAddedKg/1000).toFixed(1)} t after approval`,at})
        }else{
          s.notifications.unshift({id:`N-${Date.now()}-C`,text:`Cargo proposal for ${op.name} was not applied: its deadline or POLAR-014 capacity constraint changed before approval.`,at,read:false})
        }
      }
      if(assignedNow.length){
        s.notifications.unshift({id:`N-${Date.now()}-P`,text:`${assignedNow.length} personnel assignment(s) updated for ${op.name}.`,at,read:false})
      }
      if((assignedNow.length||cargoAddedKg>0)&&op.status!=='COMPLETED'){
        op.status='IN TRANSIT';op.timeline=Array.from(new Set([...op.timeline,'PERSONNEL ASSIGNED','ASSET ASSIGNED','CARGO LOADED','DEPARTED','IN TRANSIT']))
        s.notifications.unshift({id:`N-${Date.now()}-O`,text:`Operation readiness updated for ${op.name}.`,at,read:false})
        const actualCoverage=s.employees.filter(person=>person.operationId===op.id).length
        const actualCargo=s.cargo.filter(item=>item.operationId===op.id&&item.mode==='ship'&&['LOADED','DISPATCHED','IN TRANSIT','DELAYED','ARRIVED','UNLOADED','RECEIVED'].includes(item.status)).reduce((total,item)=>total+item.weightKg,0)/1000
        s.audit.unshift({id:`AUD-${Date.now()}-O`,actor,action:'Operation readiness updated',entity:op.id,before:'Recommendation changes pending',after:`${actualCoverage}/${op.requiredPersonnel} personnel; ${actualCargo.toFixed(1)} t cargo`,at})
      }
    }
    rec.status=decision;rec.decidedAt=at;rec.decidedBy=actor
    const before=`${rec.coverageBefore}/${op.requiredPersonnel} personnel; ${rec.cargoBefore.toFixed(1)} t cargo`
    const actualCoverage=s.employees.filter(person=>person.operationId===op.id).length
    const actualCargo=s.cargo.filter(item=>item.operationId===op.id&&item.mode==='ship'&&['LOADED','DISPATCHED','IN TRANSIT','DELAYED','ARRIVED','UNLOADED','RECEIVED'].includes(item.status)).reduce((total,item)=>total+item.weightKg,0)/1000
    const after=decision==='APPROVED'?`${actualCoverage}/${op.requiredPersonnel} personnel; ${actualCargo.toFixed(1)} t cargo`:'No operational changes'
    s.audit.unshift({id:`AUD-${Date.now()}`,actor,action:`AI recommendation ${decision.toLowerCase()}`,entity:op.id,before,after,at})
    const message=decision==='APPROVED'?`Supervisor approved recommendation for ${op.name}; applied ${assignedNow.length} personnel assignment(s) and ${(cargoAddedKg/1000).toFixed(1)} t cargo. Current state: ${actualCoverage}/${op.requiredPersonnel} personnel, ${actualCargo.toFixed(1)} t cargo.`:`Recommendation for ${op.name} was ${decision==='REJECTED'?'rejected':'returned for modification'}.`
    s.notifications.unshift({id:`N-${Date.now()}`,text:message,at,read:false})
    write({...s})
  },
  setCargoStatus(id:string,status:string){const s=read(),cargo=s.cargo.find(c=>c.id===id);if(!cargo)return;const before=cargo.status;if(before===status)return;cargo.status=status;cargo.lastUpdate=new Date().toISOString();syncAssetManifest(s,cargo.assetId);if(status==='RECEIVED'){const inventory=s.inventory.find(item=>item.base===cargo.base&&item.item.toLowerCase().includes(inventoryKeyForCategory(cargo.category)));if(inventory){const before=inventory.quantity;inventory.quantity=Math.min(100,Number(inventory.quantity)+(cargo.weightKg>=1000?8:3));s.audit.unshift({id:`AUD-${Date.now()}-INV`,actor:'HQ Logistics',action:'Inventory updated from cargo receipt',entity:`${cargo.base} ? ${inventory.item}`,before:`${before}${inventory.unit}`,after:`${inventory.quantity}${inventory.unit}`,at:new Date().toISOString()});s.notifications.unshift({id:`N-${Date.now()}-INV`,text:`${inventory.item} inventory updated at ${cargo.base} after receipt of ${cargo.id}.`,at:new Date().toISOString(),read:false})}}s.notifications.unshift({id:`N-${Date.now()}`,text:`Cargo ${cargo.id} status changed to ${status}.`,at:new Date().toISOString(),read:false});s.audit.unshift({id:`AUD-${Date.now()}`,actor:'HQ Operations',action:'Cargo status changed',entity:id,before,after:status,at:new Date().toISOString()});write({...s})},
  addNotification(text:string){const s=read();s.notifications.unshift({id:`N-${Date.now()}`,text,at:new Date().toISOString(),read:false});write({...s})},
  recordIncident(text:string,actor:string){const s=read(),at=new Date().toISOString();s.notifications.unshift({id:`N-${Date.now()}`,text,at,read:false});s.audit.unshift({id:`AUD-${Date.now()}`,actor,action:'Incident declared',entity:'Incident',before:'Not recorded',after:text,at});write({...s})},
  createFieldIncident(baseId:string,description:string,actor:string){const s=read(),base=demoBases.find(b=>b.id===baseId);if(!base||!description.trim())throw new Error('Choose a base and enter an incident description.');const at=new Date().toISOString(),operation=s.operations.find(o=>o.destination.toUpperCase()===baseId);const incident:DemoIncident={id:`INC-FIELD-${Date.now()}`,operationId:operation?.id??'',base:baseId,type:'Field report',severity:'MODERATE',status:'OPEN',syncStatus:'PENDING SYNC',description:description.trim(),point:base.point,at};s.incidents.unshift(incident);if(operation&&!(operation.incidentIds as string[]).includes(incident.id))(operation.incidentIds as string[]).push(incident.id);s.syncQueue.unshift({id:incident.id,status:'PENDING SYNC',description:`${baseId} · ${incident.description}`,at});s.notifications.unshift({id:`N-${Date.now()}`,text:`New field incident ${incident.id} recorded locally at ${baseId}; pending sync.`,at,read:false});s.audit.unshift({id:`AUD-${Date.now()}`,actor,action:'Field incident recorded locally',entity:incident.id,before:'Not recorded',after:'PENDING SYNC',at});write({...s});return incident.id},
  setIncidentStatus(id:string,status:string,actor:string){const s=read(),incident=s.incidents.find(i=>i.id===id);if(!incident)return;const before=incident.status;if(before===status)return;incident.status=status;const at=new Date().toISOString();s.audit.unshift({id:`AUD-${Date.now()}`,actor,action:'Incident status changed',entity:id,before,after:status,at});s.notifications.unshift({id:`N-${Date.now()}`,text:`Incident ${id} status changed to ${status}.`,at,read:false});write({...s})},
  createCargoIncident(cargoId:string){const s=read(),cargo=s.cargo.find(c=>c.id===cargoId);if(!cargo?.exception)return;const existing=s.incidents.find(i=>i.description.includes(cargoId));if(existing)return;const asset=s.assets.find(a=>a.id===cargo.assetId),at=new Date().toISOString(),incident:DemoIncident={id:`INC-DEMO-${Date.now()}`,operationId:cargo.operationId,base:cargo.base,type:'Cargo exception',severity:'MODERATE',status:'EXCEPTION',description:`${cargo.exception} ? ${cargoId}`,point:asset?.position??{lat:-69.4,lon:76.2},at};s.incidents.unshift(incident);const op=s.operations.find(o=>o.id===cargo.operationId);if(op&&!(op.incidentIds as string[]).includes(incident.id))(op.incidentIds as string[]).push(incident.id);s.notifications.unshift({id:`N-${Date.now()}`,text:`Cargo exception raised as ${incident.id} for ${cargoId}.`,at,read:false});s.audit.unshift({id:`AUD-${Date.now()}`,actor:'HQ Logistics',action:'Cargo exception raised as incident',entity:incident.id,before:cargo.status,after:'EXCEPTION',at});write({...s})},
  syncNow(){const s=read();s.syncQueue=s.syncQueue.map(row=>row.status==='PENDING SYNC'||row.status==='SYNC FAILED'?{...row,status:'SYNCING'}:row);write({...s});window.setTimeout(()=>{const next=read();const changed=next.syncQueue.filter(row=>row.status==='SYNCING');next.syncQueue=next.syncQueue.map(row=>{if(row.status!=='SYNCING')return row;const incident=next.incidents.find(item=>item.id===row.id);if(incident)incident.syncStatus='SYNCED';return {...row,status:'SYNCED',at:new Date().toISOString()}});next.lastSyncAt=new Date().toISOString();next.notifications.unshift({id:`N-${Date.now()}`,text:`Local demo sync simulation completed for ${changed.length} record(s); no backend upload occurred.`,at:next.lastSyncAt,read:false});next.audit.unshift({id:`AUD-${Date.now()}`,actor:'Demo Sync Simulator',action:'Local incident sync simulation completed',entity:'FIELD SYNC QUEUE',before:`${changed.length} pending/failed`,after:`${changed.length} marked synced in this browser only`,at:next.lastSyncAt});write({...next})},900)},
}
export interface TrackingService { list():DemoAsset[]; follow(assetId:string, callback:(asset:DemoAsset)=>void):()=>void; history(assetId:string):DemoAsset['history'] }
export const mockTrackingService:TrackingService={list:()=>read().assets,history:(id)=>read().assets.find(a=>a.id===id)?.history??[],follow(id,callback){const timer=window.setInterval(()=>{demoOperationsStore.updatePosition(id);const a=read().assets.find(x=>x.id===id);if(a)callback(a)},2000);return()=>window.clearInterval(timer)}}
export interface CargoService { list():DemoCargo[] }
export interface ShipService { list():DemoAsset[] }
export interface FlightService { list():DemoAsset[] }
export interface OperationService { list():DemoState['operations'] }
export interface EmployeeService { list():DemoState['employees'] }
export interface AIService { generate():DemoRecommendation }
export const mockCargoService:CargoService={list:()=>read().cargo}
export const mockShipService:ShipService={list:()=>read().assets.filter(a=>a.kind==='ship')}
export const mockFlightService:FlightService={list:()=>read().assets.filter(a=>a.kind==='flight')}
export const mockOperationService:OperationService={list:()=>read().operations}
export const mockEmployeeService:EmployeeService={list:()=>read().employees}
export const mockAIService:AIService={generate:()=>demoOperationsStore.generateRecommendation()}
export { demoBases, demoInventory }
