import {addDays, atDate, categories, dateKey, dateLabel, monthStart, readableHour, safe, weekStart} from './data.js';

export function eventForm(event={}, day=dateKey()) {
  return `<form data-form="event" class="panel form-grid">
  <input type="hidden" name="id" value="${safe(event.id)}">
  <h2>${event.id?'Editar evento':'Nuevo evento'}</h2>
  <label>Nombre<input name="title" autocomplete="off" required maxlength="120" value="${safe(event.title)}"></label>
  <label>Fecha<input name="date" type="date" required value="${safe(event.date||day)}"></label>
  <div class="pair"><label>Comienza<input name="start" type="time" required value="${safe(event.start||'09:00')}"></label><label>Termina<input name="end" type="time" required value="${safe(event.end||'10:00')}"></label></div>
  <label>Categoría<select name="category">${Object.entries(categories).map(([key,name])=>`<option value="${key}" ${event.category===key?'selected':''}>${name}</option>`).join('')}</select></label>
  <label>Detalles<textarea name="notes" rows="3" maxlength="500">${safe(event.notes)}</textarea></label>
  <button class="primary">Guardar evento</button>${event.id?`<button type="button" class="danger" data-delete-event="${safe(event.id)}">Eliminar evento</button>`:''}</form>`;
}
const abbreviations=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const eventChip = event => `<span class="chip ${categories[event.category]?event.category:'otro'}">${safe(event.title)}</span>`;
const eventLine = (event,readOnly) => `<${readOnly?'article':'button type="button" data-edit="'+safe(event.id)+'"'} class="entry"><time>${readableHour(event.start)}–${readableHour(event.end)}</time><span class="entry-content">${eventChip(event)}${event.notes?`<small>${safe(event.notes)}</small>`:''}</span></${readOnly?'article':'button'}>`;

const minutes = value => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

function weekBlocks(entries) {
  const ordered = [...entries].sort((a,b) => a.start.localeCompare(b.start));
  const blocks = [];
  let group = [], lanes = [];
  for(const event of ordered){
    const start=minutes(event.start), end=minutes(event.end);
    if(group.length&&lanes.every(time=>time<=start)){
      blocks.push(...group.map(block=>({...block,columns:lanes.length})));
      group=[];lanes=[];
    }
    let lane=lanes.findIndex(time=>time<=start);
    if(lane<0)lane=lanes.length;
    lanes[lane]=end;
    group.push({event,start,end,lane});
  }
  blocks.push(...group.map(block=>({...block,columns:lanes.length})));
  return blocks;
}

function weekView(events,week,today){
  const days=Array.from({length:7},(_,index)=>addDays(week,index));
  const entries=events.filter(event=>event.date>=days[0]&&event.date<=days[6]);
  const first=Math.min(8,...entries.map(event=>Math.floor(minutes(event.start)/60)));
  const last=Math.max(20,...entries.map(event=>Math.ceil(minutes(event.end)/60)));
  const duration=(last-first)*60;
  return `<div class="week-scroll"><div class="week-grid" style="--hours:${last-first}">
    <div class="week-corner"></div>
    ${days.map((key,index)=>`<button class="week-day" data-day="${key}" ${key===today?'aria-current="date"':''} aria-label="${safe(dateLabel(key,{dateStyle:'full'}))}"><span>${abbreviations[index]}</span><strong>${Number(key.slice(8))}</strong></button>`).join('')}
    <div class="week-hours">${Array.from({length:last-first},(_,index)=>`<span>${readableHour(String(first+index).padStart(2,'0')+':00')}</span>`).join('')}</div>
    ${days.map(key=>`<div class="week-column" ${key===today?'data-current-day':''}>${weekBlocks(entries.filter(event=>event.date===key)).map(({event,start,end,lane,columns})=>{
      const range=readableHour(event.start)+'–'+readableHour(event.end);
      return `<button tabindex="-1" data-day="${key}" class="week-event ${categories[event.category]?event.category:'otro'}" style="--top:${(start-first*60)/duration*100}%;--length:${(end-start)/duration*100}%;--left:${lane/columns*100}%;--width:${100/columns}%" aria-label="${safe(event.title+', '+range)}"><strong>${safe(event.title)}</strong><small>${range}</small></button>`;
    }).join('')}</div>`).join('')}
  </div></div>`;
}

export function calendarView(events,{day,view,tv,signedIn,editing}) {
  const month=monthStart(day), week=weekStart(day);
  const label = view==='day'?dateLabel(day,{dateStyle:'full'}):view==='week'?`${dateLabel(week,{month:'short',day:'numeric'})} – ${dateLabel(addDays(week,6),{month:'short',day:'numeric'})}`:dateLabel(day,{month:'long',year:'numeric'});
  const buttons = `<div class="period"><button data-step="-1" aria-label="Anterior">‹</button><h1>${label}</h1><button data-step="1" aria-label="Siguiente">›</button></div>
  <div class="segments" aria-label="Vista del calendario">${[['month','Mes'],['week','Semana'],['day','Día'],['agenda','Agenda']].map(([key,name])=>`<button data-view="${key}" aria-pressed="${view===key}">${name}</button>`).join('')}<button data-today>Hoy</button></div>`;
  let content='';
  const today=dateKey();
  if(view==='month') {
    const first=weekStart(month);
    const count=Math.ceil((atDate(monthStart(day,1))-atDate(first))/86_400_000/7)*7;
    const cells=Array.from({length:count},(_,i)=>{
      const key=addDays(first,i), entries=events.filter(event=>event.date===key);
      return `<button data-day="${key}" class="day ${key.slice(0,7)!==day.slice(0,7)?'other':''}" aria-label="${safe(dateLabel(key,{dateStyle:'full'})+', '+entries.length+' eventos')}" ${key===today?'aria-current="date"':''}>
      <span class="day-number">${Number(key.slice(8))}</span>${entries.slice(0,2).map(eventChip).join('')}${entries.length>2?`<small class="more">+${entries.length-2}</small>`:''}${entries.length>1?`<small class="more compact">+${entries.length-1}</small>`:''}</button>`;
    });
    content=`<div class="month-grid">${abbreviations.map(name=>`<div class="weekday">${name}</div>`).join('')}${cells.join('')}</div>
    <ul class="calendar-legend" aria-label="Categorías">${Object.entries(categories).map(([key,name])=>`<li><span class="${key}"></span>${name}</li>`).join('')}</ul>`;
  } else if(view==='week') {
    content=weekView(events,week,today);
  } else if(view==='day') {
    const entries=events.filter(event=>event.date===day);
    const start=Math.min(8,...entries.map(e=>Number(e.start.slice(0,2))));
    const end=Math.max(20,...entries.map(e=>Math.min(23,Number(e.end.slice(0,2)))));
    content=`<div class="timeline">${Array.from({length:end-start+1},(_,index)=>{
      const hour=String(start+index).padStart(2,'0');
      return `<div class="hour"><span>${readableHour(hour+':00')}</span><div>${entries.filter(event=>event.start.startsWith(hour)).map(event=>eventLine(event,tv||!event.editable)).join('')}</div></div>`;
    }).join('')}</div>`;
  } else {
    const next=monthStart(day,1);
    const entries=events.filter(event=>event.date>=month&&event.date<next);
    content=entries.length? [...new Set(entries.map(event=>event.date))].map(key=>`<section class="agenda-day"><h2>${dateLabel(key,{day:'numeric',month:'long',weekday:'short'})}</h2>${entries.filter(event=>event.date===key).map(event=>eventLine(event,tv||!event.editable)).join('')}</section>`).join(''):'<p class="empty">No tienes eventos en este mes.</p>';
  }
  return `<section class="panel calendar calendar-${view}">${buttons}${!tv&&signedIn?`<button class="primary add" data-new-event>＋ Añadir evento</button>`:''}${!tv&&editing?eventForm(editing,day):''}${content}</section>`;
}
