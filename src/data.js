export const ZONE = 'America/Puerto_Rico';
export const dateKey = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', {timeZone:ZONE, year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const dateLabel = (key, options) => new Intl.DateTimeFormat('es-PR', {timeZone:'UTC',...options}).format(new Date(key+'T12:00:00Z'));
export const atDate = key => new Date(key+'T12:00:00Z');
export const fromDate = date => date.toISOString().slice(0,10);
export const addDays = (key, days) => fromDate(new Date(atDate(key).getTime()+days*86_400_000));
export const monthStart = (key, step = 0) => { const date = atDate(key); return fromDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+step, 1, 12))); };
export const weekStart = key => addDays(key, -(atDate(key).getUTCDay()+6)%7);
export const categories = {familia:'Familia',personal:'Personal',trabajo:'Trabajo',taller:'Taller',otro:'Otro'};
export const defaults = {clock:true,weather:true,date:true,next:true,place:true,forecast:true,unit:'F',hour24:false,seconds:false,layout:'side',scale:100,shade:42,interval:20,hidden:[],order:[],widgets:[]};
export function sortedEvents(events) {return [...events].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));}
export function safe(value) {return String(value??'').replace(/[&<>"']/g, character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\x27':'&#39;'})[character]);}
export function readableHour(value) {const [h,m]=value.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' AM':' PM');}
export const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
