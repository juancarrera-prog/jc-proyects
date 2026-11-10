const CASA_SHEET_ID = '1eJn7myZ6kfHhtcdRPTtryt50dPmf87BUXG701WvIyAI';
const CASA_TABS = {compras:'CASA_Compras',pendientes:'CASA_Pendientes',casa:'CASA_Semaforo'};
const CASA_HEADERS = {
  compras:['id','producto','cantidad','unidad','categoria','completado','frecuente','creado_en','actualizado_en','creado_por'],
  pendientes:['id','tarea','fecha','completado','repeticion','notas','creado_en','actualizado_en','creado_por'],
  casa:['id','tarea','prioridad','completado','notas','creado_en','actualizado_en','creado_por']
};
const CASA_PRODUCT_TAB = 'CASA_Productos';
const CASA_PRODUCT_HEADERS = ['id','producto','categoria','favorito','creado_en','actualizado_en'];
const CASA_CATALOG = {
  'Alimentos':['Pan','Carne vacuna','Pollo','Pescado','Arroz','Fideos','Harina','Aceite','Sal','Azúcar','Lentejas','Garbanzos','Puré de tomate','Atún','Galletitas','Avena','Mermelada'],
  'Lácteos y huevos':['Leche','Huevos','Queso','Yogur','Manteca','Crema de leche','Dulce de leche'],
  'Frutas y verduras':['Papa','Cebolla','Tomate','Zanahoria','Lechuga','Zapallo','Morrón','Ajo','Banana','Manzana','Naranja','Limón'],
  'Limpieza':['Lavandina','Detergente','Esponjas','Bolsas de residuos','Jabón para ropa','Suavizante','Limpiador de pisos','Desinfectante','Rollo de cocina','Servilletas'],
  'Higiene personal':['Papel higiénico','Shampoo','Acondicionador','Jabón de tocador','Pasta dental','Cepillo de dientes','Desodorante','Toallitas femeninas','Pañales'],
  'Bebidas':['Agua','Soda','Jugo','Gaseosa','Café','Té','Yerba'],
  'Mascotas':['Alimento para perro','Alimento para gato','Piedritas sanitarias'],
  'Otros':[]
};
function productKey_(value) {
  return String(value||'').trim().replace(/\s+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
// Sheet values beginning with formula syntax must remain literal text.
function sheetText_(value) {
  return typeof value==='string' && /^[=+\-@']/.test(value) ? "'"+value : value;
}
function catalogRows_(create) {
  const book=SpreadsheetApp.openById(CASA_SHEET_ID);
  let sheet=book.getSheetByName(CASA_PRODUCT_TAB);
  if(!sheet && create) {
    sheet=book.insertSheet(CASA_PRODUCT_TAB);
    sheet.appendRow(CASA_PRODUCT_HEADERS);
  }
  if(!sheet)return {sheet:null,items:[]};
  const values=sheet.getDataRange().getDisplayValues();
  if(CASA_PRODUCT_HEADERS.some((h,i)=>values[0][i]!==h))throw new Error('Revisá los encabezados de '+CASA_PRODUCT_TAB);
  return {sheet,items:values.slice(1).map((r,i)=>Object.assign({row:i+2},Object.fromEntries(CASA_PRODUCT_HEADERS.map((h,j)=>[h,r[j]||''])))).filter(p=>p.id)};
}
function catalog_(saved) {
  const products=[];
  Object.keys(CASA_CATALOG).forEach(categoria=>CASA_CATALOG[categoria].forEach(producto=>products.push({id:'base_'+productKey_(producto).replace(/[^a-z0-9]+/g,'_'),producto,categoria,favorito:'false',propio:false})));
  const byId=new Map(products.map(p=>[p.id,p]));
  saved.forEach(p=>{
    if(byId.has(p.id))byId.get(p.id).favorito=p.favorito==='true'?'true':'false';
    else if(p.producto)products.push({id:p.id,producto:p.producto,categoria:Object.prototype.hasOwnProperty.call(CASA_CATALOG,p.categoria)?p.categoria:'Otros',favorito:p.favorito==='true'?'true':'false',propio:true});
  });
  return products;
}
function changeCasaCatalog(pin, action, payload) {
  auth_(pin);
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload=payload||{};
    if(!['add','favorite'].includes(action))throw new Error('Acción inválida');
    const saved=catalogRows_(false),products=catalog_(saved.items),now=new Date().toISOString();
    let product,existing;
    if(action==='add') {
      const name=typeof payload.producto==='string'?payload.producto.trim().replace(/\s+/g,' '):'';
      if(!name || name.length>180)throw new Error('Ingresá un nombre de hasta 180 caracteres');
      if(!Object.prototype.hasOwnProperty.call(CASA_CATALOG,payload.categoria))throw new Error('Sección inválida');
      if(products.some(p=>productKey_(p.producto)===productKey_(name)))throw new Error('Ese producto ya está en el catálogo. Buscalo para agregarlo a tu lista');
      product={id:Utilities.getUuid(),producto:name,categoria:payload.categoria,favorito:'false',creado_en:now,actualizado_en:now};
    } else {
      if(typeof payload.favorito!=='boolean')throw new Error('Favorito inválido');
      const found=products.find(p=>p.id===payload.id);
      if(!found)throw new Error('Producto no encontrado. Actualizá el catálogo');
      existing=saved.items.find(p=>p.id===found.id);
      product={...found,favorito:String(payload.favorito),creado_en:existing?existing.creado_en:now,actualizado_en:now};
    }
    const sheet=saved.sheet||catalogRows_(true).sheet;
    const values=CASA_PRODUCT_HEADERS.map(h=>sheetText_(product[h]||''));
    if(existing)sheet.getRange(existing.row,1,1,values.length).setValues([values]);
    else sheet.appendRow(values);
    return getCasa(pin);
  } finally {try {SpreadsheetApp.flush();} finally {lock.releaseLock();}}
}
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
  return {sheet, rowNumbers:values.slice(1).map((r,i)=>r[0]?i+2:0).filter(Boolean),items:values.slice(1).filter(r=>r[0]).map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]||''])))};
}
function getCasa(pin) {
  auth_(pin);
  return {...Object.fromEntries(Object.keys(CASA_TABS).map(t=>[t,rows_(t).items])),catalogo:catalog_(catalogRows_(false).items),categorias:Object.keys(CASA_CATALOG)};
}
function changeCasa(pin, type, action, payload) {
  auth_(pin);
  if (!Object.prototype.hasOwnProperty.call(CASA_TABS,type)) throw new Error('Sección inválida');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    payload=payload||{};
    const {sheet,items,rowNumbers}=rows_(type);
    const heads=CASA_HEADERS[type];
    const now=new Date().toISOString();
    if (action==='add') {
      let catalogProduct;
      if(type==='compras' && payload.catalogo_id) {
        catalogProduct=catalog_(catalogRows_(false).items).find(p=>p.id===payload.catalogo_id);
        if(!catalogProduct)throw new Error('Producto no encontrado. Actualizá el catálogo');
      }
      const title=String(catalogProduct?catalogProduct.producto:(type==='compras'?payload.producto||'':payload.tarea||'')).trim().slice(0,180);
      if (!title) throw new Error('Ingresá un nombre');
      if(type==='compras') {
        const matching=items.filter(p=>productKey_(p.producto)===productKey_(title));
        if(matching.some(p=>p.completado!=='true'))return getCasa(pin);
        if(matching.length) {
          const previous=matching[0];
          const restored={...previous,completado:'false',actualizado_en:now};
          sheet.getRange(rowNumbers[items.indexOf(previous)],1,1,heads.length).setValues([heads.map(h=>sheetText_(restored[h]||''))]);
          return getCasa(pin);
        }
      }
      const data={id:Utilities.getUuid(),producto:title,tarea:title,cantidad:'1',unidad:'u',categoria:'General',completado:'false',frecuente:'false',prioridad:'amarillo',fecha:'',repeticion:'',notas:'',creado_en:now,actualizado_en:now,creado_por:String(payload.creado_por||'Familia').slice(0,50)};
      if(type==='compras') {data.cantidad=String(payload.cantidad||'1').slice(0,20);data.categoria=catalogProduct?catalogProduct.categoria:String(payload.categoria||'General').slice(0,40);}
      if(type==='pendientes') {data.fecha=String(payload.fecha||'').slice(0,20);}
      if(type==='casa') {data.prioridad=['rojo','amarillo','verde'].includes(payload.prioridad)?payload.prioridad:'amarillo';}
      sheet.appendRow(heads.map(h=>sheetText_(data[h]||'')));
    } else if(action==='update' || action==='delete') {
      const idx=items.findIndex(x=>x.id===String(payload.id));
      if(idx<0) throw new Error('Elemento no encontrado. Actualizá la lista');
      const row=rowNumbers[idx];
      if(action==='delete') sheet.deleteRow(row);
      else {
        const current=items[idx], next={...current,actualizado_en:now};
        const allowed=type==='compras'?['completado','frecuente','cantidad']:type==='pendientes'?['completado','fecha']:['completado','prioridad'];
        allowed.forEach(k=>{if(Object.prototype.hasOwnProperty.call(payload,k))next[k]=String(payload[k]).slice(0,80);});
        if(type==='casa'&&!['rojo','amarillo','verde'].includes(next.prioridad))throw new Error('Prioridad inválida');
        sheet.getRange(row,1,1,heads.length).setValues([heads.map(h=>sheetText_(next[h]||''))]);
      }
    } else if(action==='clearDone' && type==='compras') {
      for(let i=items.length-1;i>=0;i--) if(items[i].completado==='true')sheet.deleteRow(rowNumbers[i]);
    } else if(action==='clearAll' && type==='compras') {
      if(sheet.getLastRow()>1)sheet.deleteRows(2,sheet.getLastRow()-1);
    } else throw new Error('Acción inválida');
    return getCasa(pin);
  } finally {try {SpreadsheetApp.flush();} finally {lock.releaseLock();}}
}

