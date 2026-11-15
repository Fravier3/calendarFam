import {safe} from './data.js';
const check = (name,label,settings) => `<label class="toggle"><span>${label}</span><input type="checkbox" name="${name}" ${settings[name]?'checked':''}></label>`;
const options=(values,current)=>Object.entries(values).map(([key,label])=>`<option value="${key}" ${current===key?'selected':''}>${label}</option>`).join('');
const range=(name,label,value,min,max)=>`<label>${label}<span class="range"><input type="range" name="${name}" min="${min}" max="${max}" value="${Number(value)}"><output>${Number(value)}</output></span></label>`;
export function settingsForm(s) {
  return `<form data-form="settings" class="panel form-grid"><h1>Diseña tu pantalla</h1>
  <div class="checks">${[['clock','Reloj'],['weather','Temperatura de Cayey'],['date','Fecha'],['next','Próximo evento'],['place','Nombre del fondo'],['forecast','Máxima y mínima'],['hour24','Formato de 24 horas'],['seconds','Mostrar segundos']].map(([k,l])=>check(k,l,s)).join('')}</div>
  <label>Distribución<select name="layout">${options({side:'Hora y clima lado a lado',stack:'Hora arriba, clima debajo'},s.layout)}</select></label>
  <label>Temperatura<select name="unit">${options({F:'Fahrenheit (°F)',C:'Celsius (°C)'},s.unit)}</select></label>
  ${range('scale','Tamaño de hora y clima',s.scale,70,130)}${range('shade','Oscurecer el fondo',s.shade,15,85)}${range('interval','Cambiar el fondo cada (segundos)',s.interval,8,120)}
  <button class="primary">Guardar ajustes</button></form>`;
}
export function photoForm(items,settings) {
  return `<section class="panel gallery"><h1>Fondos de la TV</h1><form data-form="photo" class="form-grid">
  <label>Nombre de tu foto<input name="name" required maxlength="75" placeholder="Ej. Cumpleaños"></label>
  <label>Imagen<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required></label><button class="primary">Añadir foto</button></form>
  <div class="photo-list">${items.map((photo,i)=>`<article><span><strong>${safe(photo.name)}</strong><small>${photo.kind==='photo'?'Foto privada':'Fondo incluido'}</small></span><div class="photo-ops"><button data-order="${safe(photo.id)}" data-dir="-1" aria-label="Subir ${safe(photo.name)}" ${i===0?'disabled':''}>↑</button><button data-order="${safe(photo.id)}" data-dir="1" aria-label="Bajar ${safe(photo.name)}" ${i===items.length-1?'disabled':''}>↓</button><button data-toggle-photo="${safe(photo.id)}" aria-pressed="${!settings.hidden.includes(photo.id)}">${settings.hidden.includes(photo.id)?'Mostrar':'Ocultar'}</button>${photo.kind==='photo'?`<button data-rename-photo="${safe(photo.id)}">Renombrar</button><button class="danger" data-delete-photo="${safe(photo.id)}">Eliminar</button>`:''}</div></article>`).join('')}</div></section>`;
}
export function widgetsForm(settings) {
  return `<section class="panel form-grid"><h1>Widgets personalizados</h1><form data-form="widget" class="form-grid"><label>Tipo<select name="type"><option value="text">Mensaje</option><option value="countdown">Cuenta regresiva</option></select></label><label>Título<input name="title" required maxlength="40"></label><label>Mensaje<input name="text" maxlength="110"></label><label>Fecha de la cuenta regresiva<input name="date" type="date"></label><button class="primary">Añadir widget</button></form>
  ${settings.widgets.map(widget=>`<div class="widget-row"><span><strong>${safe(widget.title)}</strong> <small>${widget.type==='countdown'?safe(widget.date):safe(widget.text)}</small></span><button data-remove-widget="${safe(widget.id)}">Quitar</button></div>`).join('')}</section>`;
}
