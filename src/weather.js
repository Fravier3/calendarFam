import {ZONE} from './data.js';
const endpoint = new URL('https://api.open-meteo.com/v1/forecast');
endpoint.search = new URLSearchParams({latitude:'18.1119',longitude:'-66.1660',current:'temperature_2m,weather_code,is_day',daily:'temperature_2m_max,temperature_2m_min',timezone:ZONE,forecast_days:'1'});
export async function weather() {
  const response = await fetch(endpoint, {signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Temperatura de Cayey no disponible.');
  const value=await response.json();
  if(!Number.isFinite(value.current?.temperature_2m)) throw new Error('Temperatura de Cayey no disponible.');
  const code=value.current.weather_code;
  const kind=code===0 ? 'Despejado' : code<=2 ? 'Parcialmente nublado' : code===3 ? 'Nublado' : code<=48 ? 'Neblina' : code>=95 ? 'Tormenta' : 'Lluvia';
  return {temp:value.current.temperature_2m,max:value.daily?.temperature_2m_max?.[0],min:value.daily?.temperature_2m_min?.[0],kind,icon:code===0?(value.current.is_day?'☀':'☾'):code<=48?'☁':code>=95?'ϟ':'☂'};
}
export const temperature = (n,unit) => Number.isFinite(n)?Math.round(unit==='F'?n*9/5+32:n)+'°':'—';
