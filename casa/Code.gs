const CASA_SHEET_ID = '1eJn7myZ6kfHhtcdRPTtryt50dPmf87BUXG701WvIyAI';
const CASA_TABS = {compras:'CASA_Compras',pendientes:'CASA_Pendientes',casa:'CASA_Semaforo'};
const CASA_HEADERS = {
  compras:['id','producto','cantidad','unidad','categoria','completado','frecuente','creado_en','actualizado_en','creado_por'],
  pendientes:['id','tarea','fecha','completado','repeticion','notas','creado_en','actualizado_en','creado_por'],
  casa:['id','tarea','prioridad','completado','notas','creado_en','actualizado_en','creado_por']
};
// Run setupCasa('a-strong-private-PIN') once in Apps Script editor.
// Never commit the PIN to GitHub. Both family members enter it on their devices.
function setupCasa(pin) {
  if (typeof pin !== 'string' || pin.length < 8) throw new Error('Elegí una clave de al menos 8 caracteres');
  PropertiesService.getScriptProperties().setProperty('CASA_PIN', pin);
}
function auth_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty('CASA_PIN');
  if (!expected || typeof pin !== 'string' || pin !== expected) throw new Error('Clave incorrecta o sin configurar');
}
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('CASA · Nuestro espacio')
    .addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover');
}
function rows_(type) {
  const sheet = SpreadsheetApp.openById(CASA_SHEET_ID).getSheetByName(CASA_TABS[type]);
  if (!sheet) throw new Error('Falta pestaña: '+CASA_TABS[type]);
  const values = sheet.getDataRange().getDisplayValues();
  const heads = CASA_HEADERS[type];
  return {sheet, items:values.slice(1).filter(r=>r[0]).map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]||''])))};
}
function getCasa(pin) {
  auth_(pin);
  return Object.fromEntries(Object.keys(CASA_TABS).map(t=>[t,rows_(t).items]));
}
function changeCasa(pin, type, action, payload) {
  auth_(pin);
  if (!CASA_TABS[type]) throw new Error('Sección inválida');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const {sheet,items}=rows_(type);
    const heads=CASA_HEADERS[type];
    const now=new Date().toISOString();
    if (action==='add') {
      const title=String(type==='compras'?payload.producto:payload.tarea||'').trim().slice(0,180);
      if (!title) throw new Error('Ingresá un nombre');
      const data={id:Utilities.getUuid(),producto:title,tarea:title,cantidad:'1',unidad:'u',categoria:'General',completado:'false',frecuente:'false',prioridad:'amarillo',fecha:'',repeticion:'',notas:'',creado_en:now,actualizado_en:now,creado_por:String(payload.creado_por||'Familia').slice(0,50)};
      if(type==='compras') {data.cantidad=String(payload.cantidad||'1').slice(0,20);data.categoria=String(payload.categoria||'General').slice(0,40);}
      if(type==='pendientes') {data.fecha=String(payload.fecha||'').slice(0,20);}
      if(type==='casa') {data.prioridad=['rojo','amarillo','verde'].includes(payload.prioridad)?payload.prioridad:'amarillo';}
      sheet.appendRow(heads.map(h=>data[h]||''));
    } else if(action==='update' || action==='delete') {
      const idx=items.findIndex(x=>x.id===String(payload.id));
      if(idx<0) throw new Error('Elemento no encontrado. Actualizá la lista');
      const row=idx+2;
      if(action==='delete') sheet.deleteRow(row);
      else {
        const current=items[idx], next={...current,actualizado_en:now};
        const allowed=type==='compras'?['completado','frecuente','cantidad']:type==='pendientes'?['completado','fecha']:['completado','prioridad'];
        allowed.forEach(k=>{if(Object.prototype.hasOwnProperty.call(payload,k))next[k]=String(payload[k]).slice(0,80);});
        if(type==='casa'&&!['rojo','amarillo','verde'].includes(next.prioridad))throw new Error('Prioridad inválida');
        sheet.getRange(row,1,1,heads.length).setValues([heads.map(h=>next[h]||'')]);
      }
    } else if(action==='clearDone' && type==='compras') {
      for(let i=items.length-1;i>=0;i--) if(items[i].completado==='true')sheet.deleteRow(i+2);
    } else if(action==='clearAll' && type==='compras') {
      if(items.length)sheet.deleteRows(2,items.length);
    } else throw new Error('Acción inválida');
    return getCasa(pin);
  } finally {lock.releaseLock();}
}
