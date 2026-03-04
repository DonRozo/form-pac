/* ===========================================================
   DATA-PAC | Reporte Trimestral (v2)
   Servicio: DATAPAC_V2
   =========================================================== */

// --- Servicio ---
const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V2/FeatureServer";

// --- Cartografía CAR (Jurisdicción) ---
const CAR_SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/MpiosCAR/FeatureServer";
const CAR_JUR_LAYER_ID = 0; // Municipios_CAR (4326)

// Índices (según configuración DATAPAC_V2)
const URL_ACTIVIDAD = `${SERVICE_URL}/6`;
const URL_SUBACTIVIDAD = `${SERVICE_URL}/7`;
const URL_TAREA = `${SERVICE_URL}/8`;
const URL_AVANCE_TAREA = `${SERVICE_URL}/9`;
const URL_TAREA_UBICACION = `${SERVICE_URL}/10`; 
const URL_NARRATIVA = `${SERVICE_URL}/11`;

// ---------- DOM ----------
const elActividad = document.getElementById("sel-actividad");
const elVigencia = document.getElementById("sel-vigencia");
const elPeriodo = document.getElementById("sel-periodo");
const elIndicadores = document.getElementById("indicadores"); 
const elReporteNarrativo = document.getElementById("txt-reporte-narrativo");
const elDescLogros = document.getElementById("txt-logros-descripcion");
const elPrincipalesLogros = document.getElementById("txt-logros-principales");
const elStatus = document.getElementById("status");

const btnGuardar = document.getElementById("btn-guardar");
const btnLimpiar = document.getElementById("btn-limpiar");
const btnRefresh = document.getElementById("btn-refresh");
const btnLimpiarMapa = document.getElementById("btn-limpiar-mapa");
const btnCentrar = document.getElementById("btn-centrar");
const pillActive = document.getElementById("pill-active");

// ---------- State ----------
let municipiosDomain = null;          
let actividadInfo = null;             
let subactividadInfo = null;          
let tareaInfo = null;                
let avanceInfo = null;               
let ubicacionInfo = null;            
let narrativaInfo = null;            

let cacheSubactividades = [];         
let cacheTareas = [];                 
let activeRowId = null;               
let rowGeometries = new Map();        
let rowMunicipio = new Map();         

// Map
let map, view, graphicsLayer, webMercatorUtils, sketchVM;
let jurisdiccionLayerView = null; // Guardará el LayerView para consultas rápidas

// ---------- Helpers ----------
function setStatus(msg, type="info"){
  const prefix = type === "error" ? "❌ " : (type === "success" ? "✅ " : "ℹ️ ");
  elStatus.textContent = prefix + msg;
}

function clearRowErrors(){
  document.querySelectorAll(".row.row--error").forEach(el => {
    el.classList.remove("row--error");
    const msg = el.querySelector(".row__err");
    if(msg) msg.remove();
  });
}

function markRowError(rowEl, message){
  rowEl.classList.add("row--error");
  let msg = rowEl.querySelector(".row__err");
  if(!msg){
    msg = document.createElement("div");
    msg.className = "row__err";
    msg.style.marginTop = "8px";
    msg.style.fontSize = "12px";
    msg.style.color = "#b42318";
    msg.textContent = message;
    rowEl.querySelector(".row__left")?.appendChild(msg);
  }else{
    msg.textContent = message;
  }
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function fetchJson(url, params){
  const u = new URL(url);
  Object.entries(params || {}).forEach(([k,v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { method: "GET" });
  if(!r.ok){
    const txt = await r.text();
    throw new Error(`HTTP ${r.status}: ${txt}`);
  }
  return await r.json();
}

async function postForm(url, formObj){
  const form = new URLSearchParams();
  Object.entries(formObj).forEach(([k,v]) => {
    if (v === undefined) return;
    form.append(k, typeof v === "string" ? v : JSON.stringify(v));
  });
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form
  });
  if(!r.ok){
    const txt = await r.text();
    throw new Error(`HTTP ${r.status}: ${txt}`);
  }
  return await r.json();
}

function parseDomainValues(domainObj){
  if(!domainObj) return null;
  if(Array.isArray(domainObj.codedValues)){
    const out = {};
    domainObj.codedValues.forEach(cv => out[String(cv.code)] = cv.name);
    return out;
  }
  return null;
}

function normalize(s){ return (s||"").toString().toLowerCase(); }

function pickField(fields, candidates){
  const byName = new Map((fields||[]).map(f => [normalize(f.name), f]));
  for(const c of candidates){
    const f = byName.get(normalize(c));
    if(f) return f;
  }
  for(const f of (fields||[])){
    const n = normalize(f.name);
    for(const c of candidates){
      const cc = normalize(c);
      if(n.includes(cc)) return f;
    }
  }
  return null;
}

function fieldType(fields, name){
  const f = (fields||[]).find(x => x.name === name);
  return f?.type || null;
}

function quoteIfNeeded(val, esriType){
  if(esriType === "esriFieldTypeString" || esriType === "esriFieldTypeGUID" || esriType === "esriFieldTypeDate"){
    return `'${String(val).replaceAll("'","''")}'`;
  }
  return String(val);
}

function toYesNo(v){
  const s = normalize(v);
  if(s === "si" || s === "sí" || s === "s" || s === "1" || s === "true") return true;
  if(s === "no" || s === "0" || s === "false") return false;
  return null;
}

// ---------- Geometría y Mapa ----------
function clearMapGraphics(){
  if(graphicsLayer) graphicsLayer.removeAll();
}

function removeGraphicForRow(rowId){
  if(!graphicsLayer) return;
  const toRemove = graphicsLayer.graphics.filter(g => g?.attributes?.rowId === rowId);
  toRemove.forEach(g => graphicsLayer.remove(g));
}

function upsertGraphicForRow(rowId, lon, lat, Graphic){
  removeGraphicForRow(rowId);
  const graphic = new Graphic({
    geometry: { type: "point", longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } },
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: [23,151,209,0.9],
      size: 10,
      outline: { color: [11,82,105,1], width: 2 }
    },
    attributes: { rowId }
  });
  graphicsLayer.add(graphic);
  return graphic;
}

// CORRECCIÓN 1: Se agrega la llave de cierre faltante
function zoomToPoint(lon, lat){
  if(!view) return;
  view.goTo({ center: [lon, lat], zoom: 14 });
}

// MEJORA 4: Centralizar la conversión de geometría
function getGeographicLocation(p) {
  if (p.spatialReference && p.spatialReference.isWebMercator && webMercatorUtils) {
    return webMercatorUtils.webMercatorToGeographic(p);
  }
  return p;
}

// MEJORAS 2, 3 Y 5: Consulta espacial en cliente (rápida), feedback visual y tolerancia de campos
async function updateMunicipioFromCAR(rowId, lon, lat, mapPoint){
  const rowEl = document.querySelector(`.row[data-row-id="${rowId}"]`);
  if(!rowEl) return;

  const isGeo = rowEl.getAttribute("data-geo") === "1";
  if(!isGeo) return;

  if (!jurisdiccionLayerView) {
    setStatus("La capa de municipios aún se está cargando, inténtalo en un momento.", "error");
    return;
  }

  try{
    // Feedback visual (cursor)
    document.body.style.cursor = 'wait';
    setStatus("Calculando jurisdicción localmente...", "info");

    const query = {
      geometry: mapPoint,
      spatialRelationship: "intersects",
      returnGeometry: false,
      outFields: ["*"] // Tolera cualquier estructura de campos
    };

    const result = await jurisdiccionLayerView.queryFeatures(query);
    const feats = result.features || [];

    const munEl = rowEl.querySelector(".row-mun");
    const daneEl = rowEl.querySelector(".row-dane");

    if(!feats.length){
      rowMunicipio.delete(rowId);
      if(munEl) munEl.value = "";
      if(daneEl) daneEl.value = "";
      
      view.popup.open({
        title: "Fuera de jurisdicción",
        content: "El punto no está dentro de la jurisdicción de la CAR.",
        location: mapPoint
      });
      setStatus("El punto no está dentro de la jurisdicción de la CAR. Ubica el punto nuevamente.", "error");
      return;
    }

    const a = feats[0].attributes || {};
    
    // Búsqueda dinámica tolerante
    const keys = Object.keys(a);
    const munKey = keys.find(k => normalize(k).includes("municipio") || normalize(k).includes("mpio"));
    const daneKey = keys.find(k => normalize(k).includes("dane"));

    const res = {
      municipioNombre: munKey ? a[munKey] : "",
      codigoDANE: daneKey ? a[daneKey] : ""
    };

    rowMunicipio.set(rowId, res);
    if(munEl) munEl.value = res.municipioNombre;
    if(daneEl) daneEl.value = String(res.codigoDANE ?? "");
    
    view.popup.close();
    setStatus("Municipio y DANE calculados automáticamente (Cálculo rápido en cliente).", "success");
  }catch(e){
    console.error(e);
    setStatus("Error consultando la capa de Municipios localmente.", "error");
  }finally{
    document.body.style.cursor = 'default';
  }
}

// ---------- Metadata + Field mapping ----------
async function getLayerInfo(url){ return await fetchJson(url, { f:"json" }); }

function mapActividadFields(info){
  const fields = info.fields || [];
  return {
    fields,
    globalIdField: pickField(fields, ["GlobalID", "globalid"])?.name || null,
    activoField: pickField(fields, ["Activo", "ACTIVO", "EsActivo"])?.name || null,
    vigenciaField: pickField(fields, ["Vigencia", "VIGENCIA", "Ano", "Año"])?.name || null,
    codigoField: pickField(fields, ["ActividadID", "CodigoActividad", "Codigo", "Codigo_Actividad"])?.name || null,
    nombreField: pickField(fields, ["Nombre", "NombreActividad", "Actividad", "Nombre_Actividad", "Actividades"])?.name || null
  };
}

function mapSubActividadFields(info){
  const fields = info.fields || [];
  return {
    fields,
    globalIdField: pickField(fields, ["GlobalID"])?.name || null,
    fkActividadField: pickField(fields, ["ActividadGlobalID", "ActividadGuid", "ActividadGUID", "ActividadIdGlobalID", "GlobalIDActividad", "Actividad"])?.name || null,
    codigoField: pickField(fields, ["CodigoSubActividad", "SubActividadID", "Codigo", "Codigo_SubActividad"])?.name || null,
    nombreField: pickField(fields, ["NombreSubActividad", "SubActividad", "Nombre", "Nombre_SubActividad"])?.name || null,
    activoField: pickField(fields, ["Activo", "ACTIVO", "EsActivo"])?.name || null,
    vigenciaField: pickField(fields, ["Vigencia", "VIGENCIA", "Ano", "Año"])?.name || null
  };
}

function mapTareaFields(info){
  const fields = info.fields || [];
  return {
    fields,
    globalIdField: pickField(fields, ["GlobalID"])?.name || null,
    fkSubActividadField: pickField(fields, ["SubActividadGlobalID", "SubActividadGuid", "SubActividadGUID", "GlobalIDSubActividad", "SubActividad"])?.name || null,
    codigoField: pickField(fields, ["CodigoTarea", "TareaID", "Codigo", "Codigo_Tarea"])?.name || null,
    nombreField: pickField(fields, ["NombreTarea", "Tarea", "Nombre", "Nombre_Tarea"])?.name || null,
    pesoField: pickField(fields, ["PesoTarea", "Peso", "Ponderacion", "Ponderación"])?.name || null,
    metaField: pickField(fields, ["Meta", "MetaTarea", "MetaAnual", "ValorMeta"])?.name || null,
    unidadField: pickField(fields, ["UnidadMedida", "Unidad", "UM"])?.name || null,
    geoField: pickField(fields, ["EsGeorreferenciable", "Municipalizable", "EsMunicipalizable", "RequiereUbicacion", "RequiereMunicipalizacion"])?.name || null,
    activoField: pickField(fields, ["Activo", "ACTIVO", "EsActivo"])?.name || null,
    vigenciaField: pickField(fields, ["Vigencia", "VIGENCIA", "Ano", "Año"])?.name || null
  };
}

function mapAvanceFields(info){
  const fields = info.fields || [];
  return {
    fields,
    fkTareaField: pickField(fields, ["TareaGlobalID", "GlobalIDTarea", "TareaGUID", "TareaGuid", "Tarea"])?.name || null,
    fkActividadField: pickField(fields, ["ActividadGlobalID", "GlobalIDActividad", "ActividadGUID", "ActividadGuid"])?.name || null,
    vigenciaField: pickField(fields, ["Vigencia", "Ano", "Año"])?.name || null,
    periodoField: pickField(fields, ["Periodo", "Trimestre", "PeriodoTrimestre"])?.name || null,
    valorField: pickField(fields, ["ValorReportado", "ValorEjecutado", "Valor", "Avance", "AvanceValor"])?.name || null,
    obsField: pickField(fields, ["Observaciones", "Obs", "Comentario", "Comentarios"])?.name || null,
    evidenciaField: pickField(fields, ["EvidenciaURL", "URLSoporte", "SoporteURL", "Url"])?.name || null,
    fechaField: pickField(fields, ["FechaRegistro", "Fecha", "FechaReporte"])?.name || null
  };
}

function mapUbicacionFields(info){
  const fields = info.fields || [];
  return {
    fields,
    fkAvanceField: pickField(fields, ["AvanceTareaGlobalID", "GlobalIDAvanceTarea", "AvanceGUID", "AvanceGuid", "AvanceTarea", "AvanceTareaID"])?.name || null,
    municipioNombreField: pickField(fields, ["MunicipioNombre", "Municipio", "NombreMunicipio", "Municipio_Nombre"])?.name || null,
    codigoDaneField: pickField(fields, ["CodigoDANE", "CODDANE", "CodDANE", "CodigoDane", "Codigo_DANE"])?.name || null,
    descripcionField: pickField(fields, ["Descripcion", "Descripción", "Observaciones", "Lugar", "Sitio"])?.name || null
  };
}

function mapNarrativaFields(info){
  const fields = info.fields || [];
  return {
    fields,
    fkActividadField: pickField(fields, ["ActividadGlobalID", "GlobalIDActividad", "ActividadGUID", "ActividadGuid"])?.name || null,
    vigenciaField: pickField(fields, ["Vigencia", "Ano", "Año"])?.name || null,
    periodoField: pickField(fields, ["Periodo", "Trimestre", "PeriodoTrimestre"])?.name || null,
    reporteField: pickField(fields, ["ReporteNarrativo", "TextoNarrativo", "Narrativa", "Texto", "Descripcion", "Descripción"])?.name || null,
    descLogrosField: pickField(fields, ["DescripcionLogrosAlcanzados", "DescripciónLogrosAlcanzados", "DescripcionLogros", "DescripciónLogros", "LogrosAlcanzados", "DescripcionDeLogros", "DescripciónDeLogros"])?.name || null,
    principalesLogrosField: pickField(fields, ["PrincipalesLogros", "LogrosPrincipales", "Principales", "Logros"])?.name || null,
    fechaField: pickField(fields, ["FechaRegistro", "Fecha"])?.name || null
  };
}

async function loadMunicipiosDomain(){
  const svc = await fetchJson(SERVICE_URL, { f:"json" });
  if(Array.isArray(svc?.domains)){
    const dm = {};
    for(const d of svc.domains){
      if(d?.name && d?.codedValues) dm[d.name] = parseDomainValues(d);
    }
    if(dm["DM_Municipio"]){
      municipiosDomain = dm["DM_Municipio"];
      return;
    }
  }
  const lyr = await fetchJson(`${URL_TAREA_UBICACION}`, { f:"json" });
  const municipioField = (lyr?.fields || []).find(f => normalize(f?.name) === "municipio");
  if(municipioField?.domain?.codedValues){
    municipiosDomain = parseDomainValues(municipioField.domain);
    return;
  }
  municipiosDomain = null;
}

// ---------- Load activities ----------
async function loadActividades(){
  setStatus("Cargando actividades…");
  elActividad.innerHTML = `<option value="">Cargando…</option>`;

  const vig = Number(elVigencia.value) || new Date().getFullYear();
  const fVig = actividadInfo.vigenciaField;
  const fAct = actividadInfo.activoField;
  const fGid = actividadInfo.globalIdField;
  const fCod = actividadInfo.codigoField;
  const fNom = actividadInfo.nombreField;

  if(!fGid) throw new Error("CFG_Actividad no expone campo GlobalID. Revisa la tabla 6.");

  const vigType = fieldType(actividadInfo.fields, fVig);
  const vigExpr = fVig ? `${fVig} = ${quoteIfNeeded(vig, vigType)}` : "1=1";

  let actExpr = "1=1";
  if(fAct){
    const t = fieldType(actividadInfo.fields, fAct);
    if(t === "esriFieldTypeString") actExpr = `(${fAct} = 'SI' OR ${fAct} = 'Sí' OR ${fAct} = 'S' OR ${fAct} = '1' OR ${fAct} = 'TRUE')`;
    else actExpr = `(${fAct} = 1)`;
  }

  const outFields = [fGid, fCod, fNom, fVig, fAct].filter(Boolean).join(",");

  const q = await fetchJson(`${URL_ACTIVIDAD}/query`, {
    f:"json",
    where: `${actExpr} AND ${vigExpr}`,
    outFields,
    orderByFields: fNom ? `${fNom} ASC` : (fCod ? `${fCod} ASC` : ""),
    returnGeometry: "false"
  });

  if(q?.error) throw new Error(q.error.message || "Error consultando CFG_Actividad.");

  const feats = q?.features || [];
  if(feats.length === 0){
    elActividad.innerHTML = `<option value="">No hay actividades para la vigencia ${vig}</option>`;
    setStatus("No se encontraron actividades (verifica Vigencia y datos en CFG_Actividad).", "error");
    return;
  }

  elActividad.innerHTML =
    `<option value="">— Selecciona una actividad —</option>` +
    feats.map(f => {
      const a = f.attributes || {};
      const gid = a[fGid];
      const cod = fCod ? a[fCod] : "";
      const nom = fNom ? a[fNom] : "";
      const label = (cod ? `${cod} — ` : "") + (nom || gid);
      return `<option value="${escapeHtml(gid)}">${escapeHtml(label)}</option>`;
    }).join("");

  setStatus("Actividades cargadas. Selecciona una para ver subactividades y tareas.", "success");
}

// ---------- Load subactivities + tasks ----------
async function loadSubactividadesYTareas(actividadGlobalId){
  elIndicadores.innerHTML = "";
  cacheSubactividades = [];
  cacheTareas = [];
  rowGeometries.clear();
  activeRowId = null;
  pillActive.textContent = "Registro activo: —";
  clearMapGraphics();

  if(!actividadGlobalId) return;

  setStatus("Cargando subactividades y tareas…");

  if(!subactividadInfo.fkActividadField){
    throw new Error("No se detectó el campo FK hacia Actividad en CFG_SubActividad (tabla 7).");
  }

  const subWhereParts = [];
  if(subactividadInfo.activoField){
    const t = fieldType(subactividadInfo.fields, subactividadInfo.activoField);
    subWhereParts.push(t === "esriFieldTypeString"
      ? `(${subactividadInfo.activoField} = 'SI' OR ${subactividadInfo.activoField}='1' OR ${subactividadInfo.activoField}='TRUE')`
      : `(${subactividadInfo.activoField} = 1)`);
  }
  if(subactividadInfo.vigenciaField){
    const vig = Number(elVigencia.value) || new Date().getFullYear();
    const t = fieldType(subactividadInfo.fields, subactividadInfo.vigenciaField);
    subWhereParts.push(`${subactividadInfo.vigenciaField} = ${quoteIfNeeded(vig, t)}`);
  }
  const fkType = fieldType(subactividadInfo.fields, subactividadInfo.fkActividadField);
  subWhereParts.push(`${subactividadInfo.fkActividadField} = ${quoteIfNeeded(actividadGlobalId, fkType)}`);

  const subOut = [
    subactividadInfo.globalIdField,
    subactividadInfo.fkActividadField,
    subactividadInfo.codigoField,
    subactividadInfo.nombreField,
    subactividadInfo.activoField,
    subactividadInfo.vigenciaField
  ].filter(Boolean).join(",");

  const subQ = await fetchJson(`${URL_SUBACTIVIDAD}/query`, {
    f:"json",
    where: subWhereParts.join(" AND "),
    outFields: subOut || "*",
    orderByFields: subactividadInfo.codigoField ? `${subactividadInfo.codigoField} ASC` : "",
    returnGeometry: "false"
  });

  if(subQ?.error) throw new Error(subQ.error.message || "Error consultando CFG_SubActividad.");
  cacheSubactividades = (subQ.features || []).map(f => f.attributes || {});

  if(!tareaInfo.fkSubActividadField){
    throw new Error("No se detectó el campo FK hacia SubActividad en CFG_Tarea (tabla 8).");
  }

  const subIds = cacheSubactividades.map(s => s[subactividadInfo.globalIdField]).filter(Boolean);
  if(subIds.length === 0){
    elIndicadores.innerHTML = `<div class="card"><div class="muted">No hay subactividades configuradas para esta actividad/vigencia.</div></div>`;
    setStatus("No se encontraron subactividades.", "error");
    return;
  }

  const fkSubType = fieldType(tareaInfo.fields, tareaInfo.fkSubActividadField);
  const inList = subIds.map(x => quoteIfNeeded(x, fkSubType)).join(",");
  const tareaWhereParts = [];
  if(tareaInfo.activoField){
    const t = fieldType(tareaInfo.fields, tareaInfo.activoField);
    tareaWhereParts.push(t === "esriFieldTypeString"
      ? `(${tareaInfo.activoField}='SI' OR ${tareaInfo.activoField}='1' OR ${tareaInfo.activoField}='TRUE')`
      : `(${tareaInfo.activoField}=1)`);
  }
  if(tareaInfo.vigenciaField){
    const vig = Number(elVigencia.value) || new Date().getFullYear();
    const t = fieldType(tareaInfo.fields, tareaInfo.vigenciaField);
    tareaWhereParts.push(`${tareaInfo.vigenciaField} = ${quoteIfNeeded(vig, t)}`);
  }
  tareaWhereParts.push(`${tareaInfo.fkSubActividadField} IN (${inList})`);

  const tareaOut = [
    tareaInfo.globalIdField,
    tareaInfo.fkSubActividadField,
    tareaInfo.codigoField,
    tareaInfo.nombreField,
    tareaInfo.pesoField,
    tareaInfo.metaField,
    tareaInfo.unidadField,
    tareaInfo.geoField
  ].filter(Boolean).join(",");

  const tareaQ = await fetchJson(`${URL_TAREA}/query`, {
    f:"json",
    where: tareaWhereParts.join(" AND "),
    outFields: tareaOut || "*",
    orderByFields: (tareaInfo.codigoField ? `${tareaInfo.codigoField} ASC` : ""),
    returnGeometry: "false"
  });

  if(tareaQ?.error) throw new Error(tareaQ.error.message || "Error consultando CFG_Tarea.");
  cacheTareas = (tareaQ.features || []).map(f => f.attributes || {});

  elIndicadores.innerHTML = cacheSubactividades.map(sa => subActividadCardHtml(sa)).join("");
  wireCardEvents();

  setStatus("Subactividades y tareas listas. Reporta el avance por tarea.", "success");
}

function subActividadCardHtml(sa){
  const gid = sa[subactividadInfo.globalIdField];
  const cod = subactividadInfo.codigoField ? sa[subactividadInfo.codigoField] : "";
  const nom = subactividadInfo.nombreField ? sa[subactividadInfo.nombreField] : "";
  const title = (cod ? `${cod} — ` : "") + (nom || gid);

  const safeId = String(gid).replaceAll("{","").replaceAll("}","");
  return `
  <div class="card" data-subgid="${escapeHtml(gid)}">
    <div class="card__top">
      <div>
        <p class="card__title">${escapeHtml(title)}</p>
        <div class="card__meta">
          <span>Subactividad</span>
          <span class="mono">${escapeHtml(gid)}</span>
        </div>
      </div>
      <div class="badges">
        <span class="badge">Subactividad</span>
      </div>
    </div>

    <div class="rows" id="rows-${safeId}">
      ${tareasRowsHtml(gid)}
    </div>

    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
      <button class="btn btn--ghost btn-collapse" data-rows-id="rows-${safeId}">Contraer/expandir</button>
    </div>
  </div>`;
}

function tareasRowsHtml(subGid){
  const rows = cacheTareas.filter(t => String(t[tareaInfo.fkSubActividadField]) === String(subGid));
  if(rows.length === 0){
    return `<div class="muted">No hay tareas para esta subactividad.</div>`;
  }
  return rows.map(t => tareaRowHtml(t)).join("");
}

function tareaRowHtml(t){
  const rowId = crypto.randomUUID();
  const gid = t[tareaInfo.globalIdField];
  const cod = tareaInfo.codigoField ? t[tareaInfo.codigoField] : "";
  const nom = tareaInfo.nombreField ? t[tareaInfo.nombreField] : "";
  const peso = tareaInfo.pesoField ? t[tareaInfo.pesoField] : "";
  const meta = tareaInfo.metaField ? t[tareaInfo.metaField] : "";
  const um = tareaInfo.unidadField ? t[tareaInfo.unidadField] : "";
  const geoRaw = tareaInfo.geoField ? t[tareaInfo.geoField] : null;
  const geo = toYesNo(geoRaw);

  return `
  <div class="row" data-row-id="${rowId}" data-tarea-gid="${escapeHtml(gid)}" data-tarea-label="${escapeHtml((cod || nom || gid))}" data-unidad="${escapeHtml(um)}" data-geo="${geo === true ? "1" : "0"}">
    <div class="row__left">
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Tarea</label>
        <div class="mono" style="font-size:12px; margin-bottom:6px;">${escapeHtml((cod?cod:""))} ${cod? "—" : ""} ${escapeHtml(nom || gid)}</div>
        <div class="row__mini">
          ${um ? `<span>Unidad: <b>${escapeHtml(um)}</b></span>` : ``}
          ${meta !== "" && meta !== null && meta !== undefined ? `<span>Meta: <b>${escapeHtml(meta)}</b></span>` : ``}
          ${peso !== "" && peso !== null && peso !== undefined ? `<span>Peso: <b>${escapeHtml(peso)}</b></span>` : ``}
          <span>Municipalizable: <b>${geo === true ? "SI" : "NO"}</b></span>
        </div>
      </div>

      <div class="field" style="padding:0;">
        <label>Valor reportado</label>
        <input class="row-valor" type="number" step="any" placeholder="Ej: 12" />
      </div>

      ${geo === true ? `
      <div class="field" style="padding:0;">
        <label>Municipio (calculado)</label>
        <input class="row-mun" type="text" placeholder="Se calcula al ubicar el punto" readonly />
      </div>

      <div class="field" style="padding:0;">
        <label>Código DANE (calculado)</label>
        <input class="row-dane" type="text" placeholder="Se calcula al ubicar el punto" readonly />
      </div>
      ` : ``}

      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Observaciones</label>
        <input class="row-obs" type="text" placeholder="Descripción corta del avance…" />
      </div>

      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Evidencia (URL)</label>
        <input class="row-evi" type="url" placeholder="https://…" />
      </div>
    </div>

    <div class="row__right">
      ${geo === true ? `<button class="btn btn--primary btn-activar" title="Activar para ubicar punto en el mapa">Ubicar punto</button>
      <button class="btn btn--ghost btn-ver" title="Acercar el mapa al punto">Ver punto</button>` : ``}
      <button class="btn btn--danger btn-eliminar" title="Limpiar este registro">Limpiar</button>
      <div class="row__mini">
        <span>Punto: <b class="row-pt">—</b></span>
      </div>
    </div>
  </div>`;
}

function wireCardEvents(){
  document.querySelectorAll(".btn-collapse").forEach(btn => {
    btn.addEventListener("click", () => {
      const rowsId = btn.getAttribute("data-rows-id");
      const container = document.getElementById(rowsId);
      container.style.display = (container.style.display === "none") ? "flex" : "none";
    });
  });

  document.querySelectorAll(".row").forEach(rowEl => wireRowEvents(rowEl));
}

function wireRowEvents(rowEl){
  const rowId = rowEl.getAttribute("data-row-id");
  const btnAct = rowEl.querySelector(".btn-activar");
  const btnVer = rowEl.querySelector(".btn-ver");
  const btnClr = rowEl.querySelector(".btn-eliminar");

  btnAct?.addEventListener("click", () => {
    activeRowId = rowId;
    pillActive.textContent = `Registro activo: ${rowId.slice(0,8)}…`;
    setStatus("Registro activo seleccionado. Ahora haz clic en el mapa para ubicar el punto.", "info");
  });

  btnVer?.addEventListener("click", () => {
    const pt = rowGeometries.get(rowId);
    if(!pt){
      setStatus("Este registro aún no tiene punto.", "error");
      return;
    }
    zoomToPoint(pt.lon, pt.lat);
  });

  btnClr?.addEventListener("click", () => {
    rowGeometries.delete(rowId);
    rowMunicipio.delete(rowId);
    removeGraphicForRow(rowId);
    if(activeRowId === rowId){
      activeRowId = null;
      pillActive.textContent = "Registro activo: —";
    }
    rowEl.querySelector(".row-valor").value = "";
    rowEl.querySelector(".row-obs").value = "";
    rowEl.querySelector(".row-evi").value = "";
    const mun = rowEl.querySelector(".row-mun");
    if(mun) mun.value = "";
    const dane = rowEl.querySelector(".row-dane");
    if(dane) dane.value = "";
    const ptEl = rowEl.querySelector(".row-pt");
    if(ptEl) ptEl.textContent = "—";
  });
}

// ---------- Map ----------
function initMap(){
  return new Promise((resolve, reject) => {
    require([
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/GraphicsLayer",
      "esri/layers/FeatureLayer",
      "esri/Graphic",
      "esri/widgets/Sketch/SketchViewModel",
      "esri/geometry/support/webMercatorUtils"
    ], (Map, MapView, GraphicsLayer, FeatureLayer, Graphic, SketchViewModel, _webMercatorUtils) => {
      webMercatorUtils = _webMercatorUtils;

      map = new Map({ basemap: "osm" });

      const jurisdiccionLayer = new FeatureLayer({
        url: `${CAR_SERVICE_URL}/${CAR_JUR_LAYER_ID}`,
        title: "Municipios CAR",
        opacity: 0.15,
        outFields: ["*"] 
      });
      map.add(jurisdiccionLayer);

      graphicsLayer = new GraphicsLayer({ title: "Puntos de municipalización" });
      map.add(graphicsLayer);

      view = new MapView({
        container: "map",
        map,
        center: [-74.2, 4.7],
        zoom: 8,
        popup: { dockEnabled: true, dockOptions: { position: "top-right", breakpoint: false } }
      });

      // Extraer LayerView para consulta local rápida
      view.whenLayerView(jurisdiccionLayer).then((layerView) => {
        jurisdiccionLayerView = layerView;
      });

      sketchVM = new SketchViewModel({
        view,
        layer: graphicsLayer,
        updateOnGraphicClick: false
      });

      sketchVM.on("update", async (evt) => {
        if(evt.state !== "complete") return;
        const g = (evt.graphics && evt.graphics[0]) ? evt.graphics[0] : null;
        if(!g) return;
        const rowId = g.attributes?.rowId;
        if(!rowId) return;

        const geo = getGeographicLocation(g.geometry);
        const lon = geo.longitude;
        const lat = geo.latitude;

        rowGeometries.set(rowId, { lon, lat });
        const rowEl = document.querySelector(`.row[data-row-id="${rowId}"]`);
        if(rowEl){
          const ptEl = rowEl.querySelector(".row-pt");
          if(ptEl) ptEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
        await updateMunicipioFromCAR(rowId, lon, lat, g.geometry);
      });

      view.on("click", async (evt) => {
        if(!activeRowId){
          setStatus("Primero activa un registro con el botón “Ubicar punto”.", "error");
          return;
        }

        const geo = getGeographicLocation(evt.mapPoint);
        const lon = geo.longitude;
        const lat = geo.latitude;

        rowGeometries.set(activeRowId, { lon, lat });
        const graphic = upsertGraphicForRow(activeRowId, lon, lat, Graphic);

        const rowEl = document.querySelector(`.row[data-row-id="${activeRowId}"]`);
        if(rowEl){
          const ptEl = rowEl.querySelector(".row-pt");
          if(ptEl) ptEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }

        await updateMunicipioFromCAR(activeRowId, lon, lat, evt.mapPoint);

        if(graphic){
          sketchVM.update(graphic);
        }
      });

      resolve(true);
    });
  });
}

// ---------- Save ----------
function collectDraft(){
  clearRowErrors();

  const actividadGid = elActividad.value;
  const vigRaw = elVigencia.value;
  const vig = (vigRaw === "" || vigRaw === null) ? (new Date().getFullYear()) : (isNaN(Number(vigRaw)) ? String(vigRaw) : Number(vigRaw));
  const periodo = elPeriodo.value;

  if(!actividadGid) throw new Error("Selecciona una actividad.");
  if(!periodo) throw new Error("Selecciona el periodo (trimestre).");

  const avances = [];
  const rowsForUbic = [];
  const errors = [];

  const rows = Array.from(document.querySelectorAll(".row"));
  rows.forEach(rowEl => {
    const rowId = rowEl.getAttribute("data-row-id");
    const tareaGid = rowEl.getAttribute("data-tarea-gid");
    const label = rowEl.getAttribute("data-tarea-label") || "Tarea";
    const unidad = (rowEl.getAttribute("data-unidad") || "").toLowerCase();
    const isGeo = rowEl.getAttribute("data-geo") === "1";

    const valorEl = rowEl.querySelector(".row-valor");
    const obsEl = rowEl.querySelector(".row-obs");
    const eviEl = rowEl.querySelector(".row-evi");

    const valorStr = valorEl ? valorEl.value : "";
    const obs = obsEl ? obsEl.value.trim() : "";
    const evi = eviEl ? eviEl.value.trim() : "";

    const pt = rowGeometries.get(rowId);
    const munInfo = rowMunicipio.get(rowId) || {};
    const municipioNombre = munInfo.municipioNombre || "";
    const codigoDANE = munInfo.codigoDANE || "";

    const hasAny = (valorStr !== "" && valorStr !== null) || obs || evi || (isGeo && (pt || municipioNombre || codigoDANE));
    if(!hasAny) return;

    if(valorStr === "" || valorStr === null){
      errors.push({rowEl, msg: `🔸 ${label}: falta 'Valor reportado'.`});
    }else{
      const valorNum = Number(valorStr);
      if(Number.isNaN(valorNum)){
        errors.push({rowEl, msg: `🔸 ${label}: 'Valor reportado' no es un número válido.`});
      }else{
        if(unidad.includes("porcentaje")){
          if(valorNum < 0 || valorNum > 100){
            errors.push({rowEl, msg: `🔸 ${label}: en porcentaje el valor debe estar entre 0 y 100.`});
          }
        }else{
          if(valorNum < 0) errors.push({rowEl, msg: `🔸 ${label}: el valor no puede ser negativo.`});
        }
      }
    }

    if(isGeo){
      if(!pt){
        errors.push({rowEl, msg: `🔸 ${label}: falta ubicar el punto en el mapa.`});
      }
      if(!municipioNombre || !codigoDANE){
        errors.push({rowEl, msg: `🔸 ${label}: el punto debe estar dentro de la jurisdicción CAR para calcular Municipio y DANE.`});
      }
    }

    const attrs = {};
    if(avanceInfo.fkTareaField) attrs[avanceInfo.fkTareaField] = tareaGid;
    if(avanceInfo.fkActividadField) attrs[avanceInfo.fkActividadField] = actividadGid;
    if(avanceInfo.vigenciaField) attrs[avanceInfo.vigenciaField] = vig;
    if(avanceInfo.periodoField) attrs[avanceInfo.periodoField] = periodo;

    if(avanceInfo.valorField && valorStr !== "" && valorStr !== null) attrs[avanceInfo.valorField] = Number(valorStr);
    if(avanceInfo.obsField) attrs[avanceInfo.obsField] = obs;
    if(avanceInfo.evidenciaField) attrs[avanceInfo.evidenciaField] = evi;

    avances.push({ attributes: attrs });
    rowsForUbic.push({ rowId, isGeo, municipioNombre, codigoDANE, pt });
  });

  const txtReporte = elReporteNarrativo?.value?.trim() || "";
  const txtDescLogros = elDescLogros?.value?.trim() || "";
  const txtPrincipales = elPrincipalesLogros?.value?.trim() || "";
  const hasNarrativa = !!(txtReporte || txtDescLogros || txtPrincipales);
  const narrativa = hasNarrativa ? { attributes: buildNarrativaAttrs(actividadGid, vig, periodo, {
    reporte: txtReporte,
    descLogros: txtDescLogros,
    principales: txtPrincipales
  }) } : null;

  if(avances.length === 0 && !hasNarrativa){
    throw new Error("No hay nada para enviar: registra al menos un avance o completa el reporte narrativo.");
  }

  if(errors.length){
    errors.forEach(e => markRowError(e.rowEl, e.msg));
    const first = errors[0].rowEl;
    first.scrollIntoView({behavior:"smooth", block:"center"});
    throw new Error(`Hay ${errors.length} error(es). Revisa las tareas marcadas en rojo.`);
  }

  return { avances, rowsForUbic, narrativa };
}

function buildNarrativaAttrs(actividadGid, vig, periodo, payload){
  const attrs = {};
  if(narrativaInfo?.fkActividadField) attrs[narrativaInfo.fkActividadField] = actividadGid;
  if(narrativaInfo?.vigenciaField) attrs[narrativaInfo.vigenciaField] = vig;
  if(narrativaInfo?.periodoField) attrs[narrativaInfo.periodoField] = periodo;
  
  if(narrativaInfo?.reporteField) attrs[narrativaInfo.reporteField] = payload?.reporte || null;
  if(narrativaInfo?.descLogrosField) attrs[narrativaInfo.descLogrosField] = payload?.descLogros || null;
  if(narrativaInfo?.principalesLogrosField) attrs[narrativaInfo.principalesLogrosField] = payload?.principales || null;

  if(!narrativaInfo?.reporteField && !narrativaInfo?.descLogrosField && !narrativaInfo?.principalesLogrosField){
    const oneField = pickField(narrativaInfo?.fields || [], ["ReporteNarrativo", "TextoNarrativo", "Narrativa", "Texto", "Descripcion", "Descripción"]);
    if(oneField?.name) attrs[oneField.name] = payload?.reporte || payload?.descLogros || payload?.principales || null;
  }
  if(narrativaInfo?.fechaField) attrs[narrativaInfo.fechaField] = Date.now();
  return attrs;
}

async function saveDraft(draft){
  setStatus(`Guardando ${draft.avances.length} avance(s)…`);

  const resAv = await postForm(`${URL_AVANCE_TAREA}/applyEdits`, {
    f: "json",
    adds: draft.avances,
    returnEditMoment: "true"
  });

  if(resAv?.error) throw new Error(resAv.error.message || "Error al guardar avances.");
  const addResults = resAv?.addResults || [];
  const failed = addResults.filter(r => !r.success);
  if(failed.length) throw new Error(`Se guardaron con errores: ${failed.length}. Revisa consola.`);

  const addsUbic = [];
  for(let i=0; i<addResults.length; i++){
    const ubic = draft.rowsForUbic[i];
    if(!ubic) continue;

    const globalIdAv = addResults[i]?.globalId;
    if(!globalIdAv) continue;

    const attrs = {};
    if(ubicacionInfo.fkAvanceField) attrs[ubicacionInfo.fkAvanceField] = globalIdAv;
    if(ubicacionInfo.municipioNombreField) attrs[ubicacionInfo.municipioNombreField] = ubic.municipioNombre;
    if(ubicacionInfo.codigoDaneField) attrs[ubicacionInfo.codigoDaneField] = ubic.codigoDANE;
    if(ubicacionInfo.descripcionField) attrs[ubicacionInfo.descripcionField] = null;

    addsUbic.push({
      attributes: attrs,
      geometry: { x: ubic.pt.lon, y: ubic.pt.lat, spatialReference: { wkid: 4326 } }
    });
  }

  if(addsUbic.length){
    setStatus(`Guardando ${addsUbic.length} ubicación(es)…`);
    const resUb = await postForm(`${URL_TAREA_UBICACION}/applyEdits`, { f:"json", adds: addsUbic });
    if(resUb?.error) throw new Error(resUb.error.message || "Error al guardar ubicaciones.");
    if(!(resUb?.addResults || []).every(r => r.success)) throw new Error("Algunas ubicaciones no se guardaron correctamente.");
  }

  const canSaveNarrativa = !!(narrativaInfo?.reporteField || narrativaInfo?.descLogrosField || narrativaInfo?.principalesLogrosField || (narrativaInfo?.fields || []).length);
  if(draft.narrativa && canSaveNarrativa){
    setStatus("Guardando reporte narrativo…");
    const resNar = await postForm(`${URL_NARRATIVA}/applyEdits`, { f:"json", adds: [draft.narrativa] });
    if(resNar?.error) throw new Error(resNar.error.message || "Error al guardar narrativa.");
    if(!(resNar?.addResults || []).every(r => r.success)) throw new Error("La narrativa no se guardó correctamente.");
  }

  return true;
}

// ---------- UI ----------
function clearForm(){
  if(elReporteNarrativo) elReporteNarrativo.value = "";
  if(elDescLogros) elDescLogros.value = "";
  if(elPrincipalesLogros) elPrincipalesLogros.value = "";
  rowGeometries.clear();
  clearMapGraphics();
  activeRowId = null;
  pillActive.textContent = "Registro activo: —";

  document.querySelectorAll(".row").forEach(rowEl => {
    rowEl.querySelector(".row-valor").value = "";
    rowEl.querySelector(".row-obs").value = "";
    rowEl.querySelector(".row-evi").value = "";
    const mun = rowEl.querySelector(".row-mun");
    if(mun) mun.value = "";
    const dane = rowEl.querySelector(".row-dane");
    if(dane) dane.value = "";
    const ptEl = rowEl.querySelector(".row-pt");
    if(ptEl) ptEl.textContent = "—";
  });
}

btnGuardar.addEventListener("click", async () => {
  try{
    btnGuardar.disabled = true;
    const draft = collectDraft();
    await saveDraft(draft);
    setStatus("Reporte guardado correctamente.", "success");
    clearForm();
  }catch(e){
    console.error(e);
    setStatus(e.message || "Error inesperado.", "error");
  }finally{
    btnGuardar.disabled = false;
  }
});

btnLimpiar.addEventListener("click", () => {
  clearForm();
  setStatus("Formulario limpiado.", "info");
});

btnRefresh.addEventListener("click", async () => {
  try{
    await bootstrap(true);
  }catch(e){
    console.error(e);
    setStatus("No fue posible recargar catálogos.", "error");
  }
});

elActividad.addEventListener("change", async () => {
  try{
    await loadSubactividadesYTareas(elActividad.value);
  }catch(e){
    console.error(e);
    setStatus(e.message || "Error cargando subactividades/tareas.", "error");
  }
});

elVigencia.addEventListener("change", async () => {
  try{
    await loadActividades();
    await loadSubactividadesYTareas(elActividad.value);
  }catch(e){
    console.error(e);
    setStatus(e.message || "Error recargando por vigencia.", "error");
  }
});

// ---------- Bootstrap ----------
async function bootstrap(forceReload=false){
  try{
    setStatus("Inicializando…");
    if(forceReload || !actividadInfo){
      const actMeta = await getLayerInfo(URL_ACTIVIDAD);
      actividadInfo = mapActividadFields(actMeta);

      const subMeta = await getLayerInfo(URL_SUBACTIVIDAD);
      subactividadInfo = mapSubActividadFields(subMeta);

      const tarMeta = await getLayerInfo(URL_TAREA);
      tareaInfo = mapTareaFields(tarMeta);

      const avMeta = await getLayerInfo(URL_AVANCE_TAREA);
      avanceInfo = mapAvanceFields(avMeta);

      const ubMeta = await getLayerInfo(URL_TAREA_UBICACION);
      ubicacionInfo = mapUbicacionFields(ubMeta);

      const narMeta = await getLayerInfo(URL_NARRATIVA);
      narrativaInfo = mapNarrativaFields(narMeta);
    }

    if(forceReload) municipiosDomain = null;
    if(!municipiosDomain) await loadMunicipiosDomain();

    await loadActividades();
    setStatus("Listo.", "success");
  }catch(e){
    console.error(e);
    setStatus(e.message || "Error inicializando la app. Revisa la consola.", "error");
  }
}

(async function main(){
  try{
    await initMap();
    await bootstrap(false);
  }catch(e){
    console.error(e);
    setStatus("No se pudo inicializar el mapa. Revisa conexión y consola.", "error");
    try{ await bootstrap(false); }catch(_){}
  }
})();