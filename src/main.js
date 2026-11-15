import './style.css';
import * as cloud from './cloud.js';
import {addDays,atDate,clamp,dateKey,dateLabel,defaults,monthStart,readableHour,safe,sortedEvents,ZONE} from './data.js';
import {calendarView} from './calendar.js';
import {photoForm,settingsForm,widgetsForm} from './settings.js';
import {landscapes} from './landscapes.js';
import {temperature,weather} from './weather.js';

const root=document.querySelector('#root');
const query=new URLSearchParams(location.search);
const native=query.has('native');
const tv=native||query.has('tv');
document.body.classList.toggle('tv',tv);
let account=null,records=[],settings={...defaults},events=[],photos=[],lastSnapshot='',syncPromise,rotation,scene=0,selection='';
let tab=tv?'ambient':'account',day=dateKey(),view='month',previousView='month',editing=null,weatherData=null,notice='';
const photoCache=new Map();
let backgroundEpoch=0;
const clockSettings={timeZone:ZONE,hour:'numeric',minute:'2-digit'};
const settingsId=()=>account.$id;
function show(message) {
  notice=message;
  const output=document.querySelector('#notice');
  if(output) output.textContent=message;
}
function report(error) {show(error?.message||'No se pudo completar el cambio.');}
function gallery() {
  const items=[...landscapes,...photos];
  const byId=new Map(items.map(item=>[item.id,item]));
  const ordered=settings.order.flatMap(id=>{const item=byId.get(id);byId.delete(id);return item?[item]:[];});
  return [...ordered,...byId.values()];
}
async function sync(force=false) {
  if(!account)return;
  if(syncPromise) {await syncPromise;if(!force)return;}
  syncPromise=(async()=>{
    const next=await cloud.state();
    const snapshot=JSON.stringify(next);
    if(snapshot===lastSnapshot&&!force)return;
    records=next;
    lastSnapshot=snapshot;
    settings={...defaults,...records.find(x=>x.kind==='settings'&&x.id===settingsId())};
    events=sortedEvents(records.filter(x=>x.kind==='event'));
    photos=records.filter(x=>x.kind==='photo');
    if(force||tv||!root.querySelector('form')&&tab!=='account')render();
  })();
  try {await syncPromise;} finally {syncPromise=null;}
}
function clearSession() {
  for(const url of photoCache.values()) URL.revokeObjectURL(url);
  photoCache.clear();
  account=null;records=[];settings={...defaults};events=[];photos=[];lastSnapshot='';
}
async function saveSettings(change) {
  const {id,kind,...payload}={...settings,...change};
  await cloud.saveRecord(account.$id,'settings',payload,settingsId());
  await sync(true);
}
async function photoUrl(photo) {
  if(photo.kind!=='photo')return native?'/tv-assets/'+photo.id+'.webp':photo.url;
  if(!photoCache.has(photo.fileId))photoCache.set(photo.fileId,await cloud.privatePhoto(photo.fileId));
  return photoCache.get(photo.fileId);
}
async function changeBackground() {
  const epoch=++backgroundEpoch;
  const stage=root.querySelector('.ambient');
  if(!stage)return;
  const list=gallery().filter(item=>!settings.hidden.includes(item.id));
  const image=stage.querySelector('.backdrop');
  if(!list.length){image.removeAttribute('src');stage.querySelector('.credit').replaceChildren();return;}
  const offset=scene%list.length;
  for(let step=0;step<list.length;step++){
    const photo=list[(offset+step)%list.length];
    try {
      const url=await photoUrl(photo);
      const preload=new Image();
      preload.src=url;
      await preload.decode();
      if(epoch!==backgroundEpoch||!stage.isConnected)return;
      image.src=url;selection=photo.id;
      const credit=stage.querySelector('.credit'), name=document.createElement('strong');
      name.textContent=photo.name;
      credit.replaceChildren();
      if(settings.place)credit.append(name);
      if(photo.wiki){
        const link=document.createElement(tv?'span':'a');
        if(!tv){link.href=photo.wiki;link.target='_blank';link.rel='noopener noreferrer';}
        link.textContent=photo.author+' · '+photo.license;
        credit.append(link);
      }
      return;
    } catch {if(epoch!==backgroundEpoch)return;}
  }
}
function updateClock() {
  const time=root.querySelector('[data-clock]');
  if(!time)return;
  const parts=new Intl.DateTimeFormat('en-US',{...clockSettings,hour12:!settings.hour24,...(settings.seconds?{second:'2-digit'}:{})}).formatToParts(new Date());
  time.firstElementChild.textContent=parts.filter(part=>part.type!=='dayPeriod').map(part=>part.value).join('').trim();
  time.lastElementChild.textContent=parts.find(part=>part.type==='dayPeriod')?.value||'';
}
async function refreshWeather() {
  try {weatherData=await weather();} catch {weatherData=null;}
  const block=root.querySelector('.weather-data');
  if(block)block.innerHTML=weatherDisplay();
}
function weatherDisplay() {
  const w=weatherData,unit=settings.unit;
  return `<div class="temperature"><i aria-hidden="true">${w?.icon||'○'}</i>${temperature(w?.temp,unit)}<small>${unit}</small></div><strong>${w?.kind||'Clima no disponible'}</strong>${settings.forecast&&w?`<span>Máx. ${temperature(w.max,unit)} · Mín. ${temperature(w.min,unit)}</span>`:''}`;
}
function ambientView() {
  const today=dateKey();
  const now=new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  const next=events.find(item=>item.date>today||item.date===today&&item.end>=now);
  return `<section class="ambient ${settings.layout==='stack'?'stack':''}" style="--shade:${clamp(Number(settings.shade),15,85)/100};--scale:${clamp(Number(settings.scale),70,130)/100}">
  <img class="backdrop" alt=""><div class="readouts">
  ${settings.clock?`<div class="clock">${settings.date?`<p>${dateLabel(today,{dateStyle:'full'})}</p>`:''}<time data-clock><span></span><small></small></time></div>`:(settings.date?`<p class="only-date">${dateLabel(today,{dateStyle:'full'})}</p>`:'')}
  ${settings.weather?`<div class="weather"><p>Cayey, Puerto Rico</p><div class="weather-data">${weatherDisplay()}</div></div>`:''}</div>
  <div class="ambient-meta">${settings.next&&next?`<p><small>Próximo evento</small><strong>${safe(next.title)}</strong><span>${safe(dateLabel(next.date,{month:'short',day:'numeric'}))} · ${readableHour(next.start)}</span></p>`:''}
  ${settings.widgets.map(widget=>`<p><small>${safe(widget.title)}</small><strong>${widget.type==='countdown'?Math.max(0,Math.round((atDate(widget.date)-atDate(today))/86_400_000))+' días':safe(widget.text)}</strong></p>`).join('')}
  </div><div class="credit"></div></section>`;
}
function accountView() {
  if(account)return `<section class="panel form-grid"><h1>Tu cuenta</h1><p>${safe(account.name||account.email)}</p><p>Usa esta misma cuenta en el teléfono y en la TV para compartir eventos, ajustes e imágenes.</p><button class="primary" data-tab="ambient">Abrir Ambiente</button><button data-logout>Cerrar sesión</button></section>`;
  return `<section class="panel signin"><h1>Tu centro familiar</h1><p>Entra con la misma cuenta en el celular y la TV.</p><form class="form-grid" data-form="login"><label>Correo<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" minlength="8" autocomplete="current-password" required></label><button class="primary">Entrar</button></form>
  ${!tv?`<details><summary>Crear una cuenta</summary><form class="form-grid" data-form="signup"><label>Tu nombre<input name="name" autocomplete="name" maxlength="75" required></label><label>Correo<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="primary">Crear cuenta</button></form></details>`:''}</section>`;
}
const tabs=tv?[['ambient','Ambiente'],['calendar','Calendario'],['account','Cuenta']]:[['ambient','Portada'],['calendar','Calendario'],['photos','Fondos'],['settings','Personalizar'],['account','Cuenta']];
function render() {
  const focus=document.activeElement?.dataset.day||document.activeElement?.dataset.tab;
  const showForm=account||!['photos','settings'].includes(tab);
  const content=!showForm?accountView():tab==='ambient'?ambientView():tab==='calendar'?calendarView(events,{day,view,tv,signedIn:!!account,editing}):tab==='photos'?photoForm(gallery(),settings):tab==='settings'?settingsForm(settings)+widgetsForm(settings):accountView();
  root.innerHTML=`<header class="top"><strong>Centro Vazquez Santiago</strong><nav>${tabs.map(([id,label])=>`<button data-tab="${id}" aria-current="${tab===id?'page':'false'}">${label}</button>`).join('')}</nav></header><div class="main ${tab==='ambient'?'full':''}">${content}</div><output id="notice" aria-live="polite">${safe(notice)}</output>`;
  clearInterval(rotation);
  if(tab==='ambient'){
    const selectedIndex=gallery().filter(p=>!settings.hidden.includes(p.id)).findIndex(p=>p.id===selection);
    if(selectedIndex>=0)scene=selectedIndex;
    updateClock();changeBackground();
    rotation=setInterval(()=>{scene++;changeBackground();},clamp(Number(settings.interval),8,120)*1000);
  }
  if(tv){
    const candidates=[...root.querySelectorAll('[data-day],[data-tab]')];
    (candidates.find(el=>el.dataset.day===focus||el.dataset.tab===focus)||root.querySelector('[data-tab="'+tab+'"]'))?.focus({preventScroll:true});
  }
}
async function submit(form) {
  const data=Object.fromEntries(new FormData(form));
  const button=form.querySelector('button[type=submit],button:not([type])');
  if(button)button.disabled=true;
  try {
    if(['login','signup'].includes(form.dataset.form)){
      account=await cloud.signIn(data.email,data.password,data.name?.trim());
      tab='ambient';notice='Sesión iniciada';await sync(true);render();return;
    }
    if(!account)throw new Error('Entra a tu cuenta para guardar.');
    switch(form.dataset.form){
      case 'settings': {
        const allowed=['clock','weather','date','next','place','forecast','hour24','seconds'];
        const values=Object.fromEntries(allowed.map(key=>[key,data[key]==='on']));
        await saveSettings({...values,layout:data.layout,unit:data.unit,scale:Number(data.scale),shade:Number(data.shade),interval:Number(data.interval)});
        break;
      }
      case 'widget': {
        if(data.type==='countdown'&&!data.date)throw new Error('Selecciona una fecha.');
        if(data.type==='text'&&!data.text.trim())throw new Error('Escribe el mensaje.');
        if(settings.widgets.length>=6)throw new Error('Puedes mostrar hasta seis widgets.');
        await saveSettings({widgets:[...settings.widgets,{...data,id:crypto.randomUUID()}]});break;
      }
      case 'event': {
        const {id,...payload}=data;
        payload.title=payload.title.trim();
        if(!payload.title||payload.end<=payload.start)throw new Error('Escribe un nombre y una hora de fin posterior al comienzo.');
        await cloud.saveRecord(account.$id,'event',payload,id||undefined);
        editing=null;day=payload.date;await sync(true);break;
      }
      case 'photo': {
        const file=data.image;
        if(!file?.size||file.size>20_000_000)throw new Error('Selecciona una imagen de hasta 20 MB.');
        if(!data.name.trim())throw new Error('Escribe el nombre de la imagen.');
        const saved=await cloud.upload(account.$id,file);
        try {await cloud.saveRecord(account.$id,'photo',{name:data.name.trim(),fileId:saved.$id});}
        catch(error){await cloud.deletePhoto(saved.$id).catch(()=>{});throw error;}
        await sync(true);break;
      }
    }
    show('Cambios guardados');
  } finally {if(button)button.disabled=false;}
}
root.addEventListener('submit',event=>{event.preventDefault();submit(event.target).catch(report);});
root.addEventListener('input',event=>{if(event.target.type==='range')event.target.nextElementSibling.textContent=event.target.value;});
root.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button||button.closest('form')&&button.type==='submit')return;
  const d=button.dataset;
  try {
    if(d.tab){tab=d.tab;editing=null;notice='';render();if(account)sync().catch(report);return;}
    if('logout'in d){await cloud.signOut();clearSession();tab='account';render();return;}
    if(d.view){view=d.view;render();return;}
    if(d.day){previousView=view;view='day';day=d.day;render();return;}
    if(d.step){day=['month','agenda'].includes(view)?monthStart(day,Number(d.step)):addDays(day,Number(d.step)*(view==='week'?7:1));render();return;}
    if('today'in d){day=dateKey();render();return;}
    if('newEvent'in d||d.edit){editing=d.edit?events.find(item=>item.id===d.edit):{};render();root.querySelector('[data-form=event] input[name=title]')?.focus();return;}
    if(d.deleteEvent&&confirm('¿Eliminar este evento?')){await cloud.deleteRecord(d.deleteEvent);editing=null;await sync(true);}
    if(d.removeWidget)await saveSettings({widgets:settings.widgets.filter(w=>w.id!==d.removeWidget)});
    if(d.togglePhoto){const hidden=settings.hidden.includes(d.togglePhoto)?settings.hidden.filter(id=>id!==d.togglePhoto):[...settings.hidden,d.togglePhoto];await saveSettings({hidden});}
    if(d.order){const order=gallery().map(item=>item.id), i=order.indexOf(d.order), target=i+Number(d.dir);if(i>=0&&target>=0&&target<order.length){[order[i],order[target]]=[order[target],order[i]];await saveSettings({order});}}
    if(d.renamePhoto){const photo=photos.find(item=>item.id===d.renamePhoto);const name=prompt('Nombre de la foto',photo.name)?.trim().slice(0,75);if(name){await cloud.saveRecord(account.$id,'photo',{name,fileId:photo.fileId},photo.id);await sync(true);}}
    if(d.deletePhoto&&confirm('¿Eliminar esta foto de tu cuenta?')){const photo=photos.find(item=>item.id===d.deletePhoto);await cloud.deleteRecord(photo.id);await cloud.deletePhoto(photo.fileId);await sync(true);}
  } catch(error){report(error);}
});
if(tv) document.addEventListener('keydown',event=>{
  if(['INPUT','TEXTAREA'].includes(event.target.tagName))return;
  if(event.key==='Escape'||event.key==='BrowserBack'){
    if(tab==='calendar'&&view==='day'){view=previousView;render();}
    else {tab='ambient';render();}
    event.preventDefault();return;
  }
  const axis={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(!axis)return;
  const center=element=>{const rect=element.getBoundingClientRect();return [rect.x+rect.width/2,rect.y+rect.height/2];};
  const [x,y]=center(document.activeElement);
  const next=[...root.querySelectorAll('button:not([disabled]),input,summary')].map(element=>{
    const [cx,cy]=center(element), along=(cx-x)*axis[0]+(cy-y)*axis[1], across=Math.abs((cx-x)*axis[1]+(cy-y)*axis[0]);
    return {element,along,score:along+across*3};
  }).filter(item=>item.along>3).sort((a,b)=>a.score-b.score)[0];
  if(next){next.element.focus();event.preventDefault();}
});
window.addEventListener('calendar-native-back',()=>{if(tab==='calendar'&&view==='day')view=previousView;else tab='ambient';render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){sync().catch(report);updateClock();}});
render();
refreshWeather();
cloud.session().then(async user=>{if(user){account=user;if(!tv)tab='ambient';await sync(true);}}).catch(report);
setInterval(updateClock,1000);
setInterval(refreshWeather,10*60*1000);
setInterval(()=>{if(account&&!document.hidden)sync().catch(report);},tv?10000:30000);
if(!native&&'serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').then(reg=>reg.update()).catch(()=>{});
