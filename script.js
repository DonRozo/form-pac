/* ===========================================================
   DATA-PAC | Reporte Trimestral (v2)
   Servicio: DATAPAC_V2
   Esquema: Estricto según definición JSON
   Mejoras: Inyección de Responsable y Descripción de Sitio
   =========================================================== */

// --- Servicio ---
const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V2/FeatureServer";
const CAR_SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/MpiosCAR/FeatureServer";
const CAR_JUR_LAYER_ID = 0; 

// Índices
const URL_ACTIVIDAD = `${SERVICE_URL}/6`;
const URL_SUBACTIVIDAD = `${SERVICE_URL}/7`;
const URL_TAREA = `${SERVICE_URL}/8`;
const URL_AVANCE_TAREA = `${SERVICE_URL}/9`;
const URL_TAREA_UBICACION = `${SERVICE_URL}/10`; 
const URL_NARRATIVA = `${SERVICE_URL}/11`;
const URL_ASIGNACION = `${SERVICE_URL}/15`; 
const URL_PERSONA = `${SERVICE_URL}/16`; 

// Mapeo Estricto de Campos (Basado en Esquema JSON)
const F_ACT = { gid: "GlobalID", id: "ActividadID", nom: "NombreActividad", vig: "Vigencia", act: "Activo" };
const F_SUB = { gid: "GlobalID", fkAct: "ActividadGlobalID", id: "CodigoSubActividad", nom: "NombreSubActividad" };
const F_TAR = { gid: "GlobalID", fkSub: "SubActividadGlobalID", id: "CodigoTarea", nom: "NombreTarea", um: "UnidadMedida", geo: "EsGeorreferenciable" };
const F_AVA = { fkTarea: "TareaGlobalID", vig: "Vigencia", per: "Periodo", val: "ValorReportado", obs: "Observaciones", evi: "EvidenciaURL", fec: "FechaRegistro", resp: "Responsable" };
const F_UBI = { fkAvance: "AvanceTareaGlobalID", dane: "CodigoDANE", mun: "MunicipioNombre", desc: "DescripcionSitio", fec: "FechaRegistro" };
const F_NAR = { fkAct: "ActividadGlobalID", vig: "Vigencia", per: "Periodo", txt1: "TextoNarrativo", txt2: "DescripcionLogrosAlcanzados", txt3: "PrincipalesLogros", fec: "FechaRegistro", resp: "Responsable" };
const F_ASIG = { fkPers: "PersonaGlobalID", actId: "ActividadID", vig: "Vigencia", act: "Activo" };
const F_PERS = { gid: "GlobalID", nom: "Nombre", act: "Activo" };

// ---------- DOM ----------
const elActividad = document.getElementById("sel-actividad");
const elVigencia = document.getElementById("sel-vigencia");
const elPeriodo = document.getElementById("sel-periodo");
const elIndicadores = document.getElementById("indicadores"); 
const elReporteNarrativo = document.getElementById("txt-reporte-narrativo");
const elDescLogros = document.getElementById("txt-logros-descripcion");
const elPrincipalesLogros = document.getElementById("txt-logros-principales");
const elStatus = document.getElementById("status");
const elResponsable = document.getElementById("lbl-responsable");

const btnGuardar = document.getElementById("btn-guardar");
const btnLimpiar = document.getElementById("btn-limpiar");
const btnRefresh = document.getElementById("btn-refresh");
const btnCentrar = document.getElementById("btn-centrar");
const btnLimpiarMapa = document.getElementById("btn-limpiar-mapa");
const pillActive = document.getElementById("pill-active");

// ---------- State ----------
let cacheSubactividades = [];         
let cacheTareas = [];                 
let activeRowId = null;               
let rowGeometries = new Map();        
let rowMunicipio = new Map();         
let currentResponsable = "";          // Almacena el responsable actual

// Map
let map, view, graphicsLayer, webMercatorUtils, sketchVM;
let jurisdiccionLayerView = null; 

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

function normalize(s){ return (s||"").toString().toLowerCase(); }

function toYesNo(v){
  const s = normalize(v);
  if(s === "si" || s === "sí" || s === "s" || s === "1" || s === "true") return true;
  if(s === "no" || s === "0" || s === "false") return false;
  return null;
}

async function fetchJson(url, params){
  const u = new URL(url);
  Object.entries(params || {}).forEach(([k,v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { method: "GET" });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

async function postForm(url, formObj){
  const form = new URLSearchParams();
  Object.entries(formObj).forEach(([k,v]) => {
    if (v === undefined || v === null) return;
    form.append(k, typeof v === "string" ? v : JSON.stringify(v));
  });
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form
  });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
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
      type: "simple-marker", style: "circle", color: [23,151,209,0.9],
      size: 10, outline: { color: [11,82,105,1], width: 2 }
    },
    attributes: { rowId }
  });
  graphicsLayer.add(graphic);
  return graphic;
}

function zoomToPoint(lon, lat){
  if(!view) return;
  view.goTo({ center: [lon, lat], zoom: 14 });
}

function getGeographicLocation(p) {
  if (p.spatialReference && p.spatialReference.isWebMercator && webMercatorUtils) {
    return webMercatorUtils.webMercatorToGeographic(p);
  }
  return p;
}

async function updateMunicipioFromCAR(rowId, lon, lat, mapPoint){
  const rowEl = document.querySelector(`.row[data-row-id="${rowId}"]`);
  if(!rowEl) return;

  const isGeo = rowEl.getAttribute("data-geo") === "1";
  if(!isGeo) return;

  if (!jurisdiccionLayerView) return;

  try{
    document.body.style.cursor = 'wait';
    const query = { geometry: mapPoint, spatialRelationship: "intersects", returnGeometry: false, outFields: ["*"] };
    const result = await jurisdiccionLayerView.queryFeatures(query);
    const feats = result.features || [];

    const munEl = rowEl.querySelector(".row-mun");
    const daneEl = rowEl.querySelector(".row-dane");

    if(!feats.length){
      rowMunicipio.delete(rowId);
      if(munEl) munEl.value = "";
      if(daneEl) daneEl.value = "";
      view.popup.open({ title: "Fuera de jurisdicción", content: "El punto no está dentro de la CAR.", location: mapPoint });
      setStatus("El punto no está dentro de la jurisdicción de la CAR.", "error");
      return;
    }

    const a = feats[0].attributes || {};
    const keys = Object.keys(a);
    const munKey = keys.find(k => normalize(k).includes("municipio") || normalize(k).includes("mpio"));
    const daneKey = keys.find(k => normalize(k).includes("dane"));

    const res = { municipioNombre: munKey ? a[munKey] : "", codigoDANE: daneKey ? a[daneKey] : "" };
    rowMunicipio.set(rowId, res);
    if(munEl) munEl.value = res.municipioNombre;
    if(daneEl) daneEl.value = String(res.codigoDANE ?? "");
    
    view.popup.close();
    setStatus("Municipio y DANE calculados correctamente.", "success");
  }catch(e){
    console.error(e);
  }finally{
    document.body.style.cursor = 'default';
  }
}

// ---------- Carga de Datos y Responsable ----------
async function fetchResponsable(actividadId, vigencia) {
  try {
    if(!actividadId) return "";
    
    // 1. Consultar PersonaGlobalID en SEG_Asignacion
    const qAsig = await fetchJson(`${URL_ASIGNACION}/query`, {
      f: "json",
      where: `${F_ASIG.actId} = '${actividadId}' AND ${F_ASIG.vig} = ${vigencia} AND ${F_ASIG.act} = 'SI'`,
      outFields: F_ASIG.fkPers,
      returnGeometry: "false"
    });
    
    const asigFeats = qAsig?.features || [];
    if(asigFeats.length === 0) return "";
    const personaId = asigFeats[0].attributes[F_ASIG.fkPers];
    if(!personaId) return "";

    // 2. Consultar Nombre en SEG_Persona
    const qPers = await fetchJson(`${URL_PERSONA}/query`, {
      f: "json",
      where: `${F_PERS.gid} = '${personaId}' AND ${F_PERS.act} = 'SI'`,
      outFields: F_PERS.nom,
      returnGeometry: "false"
    });
    
    const persFeats = qPers?.features || [];
    if(persFeats.length === 0) return "";
    return persFeats[0].attributes[F_PERS.nom] || "";
    
  } catch(e) {
    console.error("Error obteniendo responsable:", e);
    return "";
  }
}

async function loadActividades(){
  setStatus("Cargando actividades…");
  elActividad.innerHTML = `<option value="">Cargando…</option>`;
  elResponsable.textContent = "Responsable: —";
  currentResponsable = "";

  const vig = Number(elVigencia.value) || new Date().getFullYear();
  
  const q = await fetchJson(`${URL_ACTIVIDAD}/query`, {
    f: "json",
    where: `${F_ACT.act} = 'SI' AND ${F_ACT.vig} = ${vig}`,
    outFields: `${F_ACT.gid},${F_ACT.id},${F_ACT.nom}`,
    orderByFields: `${F_ACT.id} ASC`,
    returnGeometry: "false"
  });

  if(q?.error) throw new Error(q.error.message);

  const feats = q?.features || [];
  if(feats.length === 0){
    elActividad.innerHTML = `<option value="">No hay actividades activas para la vigencia ${vig}</option>`;
    setStatus("No se encontraron actividades.", "error");
    return;
  }

  elActividad.innerHTML = `<option value="">— Selecciona una actividad —</option>` +
    feats.map(f => {
      const a = f.attributes || {};
      const label = (a[F_ACT.id] ? `${a[F_ACT.id]} — ` : "") + (a[F_ACT.nom] || a[F_ACT.gid]);
      return `<option value="${escapeHtml(a[F_ACT.gid])}" data-codigo="${escapeHtml(a[F_ACT.id])}">${escapeHtml(label)}</option>`;
    }).join("");

  setStatus("Actividades cargadas. Selecciona una para ver tareas.", "success");
}

async function loadSubactividadesYTareas(actividadGlobalId){
  elIndicadores.innerHTML = "";
  cacheSubactividades = [];
  cacheTareas = [];
  rowGeometries.clear();
  activeRowId = null;
  pillActive.textContent = "Registro activo: —";
  clearMapGraphics();

  if(!actividadGlobalId) return;

  setStatus("Cargando estructura de tareas…");

  const subQ = await fetchJson(`${URL_SUBACTIVIDAD}/query`, {
    f: "json",
    where: `${F_SUB.fkAct} = '${actividadGlobalId}'`,
    outFields: "*",
    orderByFields: `${F_SUB.id} ASC`,
    returnGeometry: "false"
  });

  if(subQ?.error) throw new Error(subQ.error.message);
  cacheSubactividades = (subQ.features || []).map(f => f.attributes || {});

  const subIds = cacheSubactividades.map(s => s[F_SUB.gid]).filter(Boolean);
  if(subIds.length === 0){
    elIndicadores.innerHTML = `<div class="card"><div class="muted">No hay subactividades configuradas.</div></div>`;
    setStatus("No se encontraron subactividades.", "error");
    return;
  }

  const inList = subIds.map(x => `'${x}'`).join(",");
  const tareaQ = await fetchJson(`${URL_TAREA}/query`, {
    f: "json",
    where: `${F_TAR.fkSub} IN (${inList})`,
    outFields: "*",
    orderByFields: `${F_TAR.id} ASC`,
    returnGeometry: "false"
  });

  if(tareaQ?.error) throw new Error(tareaQ.error.message);
  cacheTareas = (tareaQ.features || []).map(f => f.attributes || {});

  elIndicadores.innerHTML = cacheSubactividades.map(sa => subActividadCardHtml(sa)).join("");
  wireCardEvents();
  setStatus("Formulario de tareas listo.", "success");
}

function subActividadCardHtml(sa){
  const gid = sa[F_SUB.gid];
  const cod = sa[F_SUB.id] || "";
  const nom = sa[F_SUB.nom] || "";
  const title = (cod ? `${cod} — ` : "") + (nom || gid);
  const safeId = String(gid).replaceAll("{","").replaceAll("}","").replaceAll("-","");

  return `
  <div class="card" data-subgid="${escapeHtml(gid)}">
    <div class="card__top">
      <div>
        <p class="card__title">${escapeHtml(title)}</p>
        <div class="card__meta"><span>Subactividad</span></div>
      </div>
      <div class="badges"><span class="badge">Estructura</span></div>
    </div>
    <div class="rows" id="rows-${safeId}">
      ${tareasRowsHtml(gid)}
    </div>
    <div style="margin-top:10px; display:flex;">
      <button class="btn btn--ghost btn-collapse" data-rows-id="rows-${safeId}">Contraer/expandir</button>
    </div>
  </div>`;
}

function tareasRowsHtml(subGid){
  const rows = cacheTareas.filter(t => String(t[F_TAR.fkSub]) === String(subGid));
  if(rows.length === 0) return `<div class="muted">No hay tareas asociadas.</div>`;
  return rows.map(t => tareaRowHtml(t)).join("");
}

function tareaRowHtml(t){
  const rowId = crypto.randomUUID();
  const gid = t[F_TAR.gid];
  const cod = t[F_TAR.id] || "";
  const nom = t[F_TAR.nom] || "";
  const um = t[F_TAR.um] || "";
  const geo = toYesNo(t[F_TAR.geo]);

  return `
  <div class="row" data-row-id="${rowId}" data-tarea-gid="${escapeHtml(gid)}" data-tarea-label="${escapeHtml((cod || nom || gid))}" data-geo="${geo === true ? "1" : "0"}">
    <div class="row__left">
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Tarea</label>
        <div class="mono" style="font-size:12px; margin-bottom:6px;">${escapeHtml(cod)} ${cod?"—":""} ${escapeHtml(nom)}</div>
        <div class="row__mini">
          ${um ? `<span>UM: <b>${escapeHtml(um)}</b></span>` : ``}
          <span>Mpio: <b>${geo === true ? "SI" : "NO"}</b></span>
        </div>
      </div>
      <div class="field" style="padding:0;">
        <label>Valor reportado</label>
        <input class="row-valor" type="number" step="any" placeholder="Ej: 12" />
      </div>
      
      ${geo === true ? `
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Descripción del sitio</label>
        <input class="row-desc-sitio" type="text" placeholder="Ej: Vereda San Juan, finca El Recuerdo..." />
      </div>
      <div class="field" style="padding:0;"><label>Municipio</label><input class="row-mun" type="text" readonly /></div>
      <div class="field" style="padding:0;"><label>Cód. DANE</label><input class="row-dane" type="text" readonly /></div>
      ` : ``}
      
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Observaciones</label><input class="row-obs" type="text" />
      </div>
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Evidencia (URL)</label><input class="row-evi" type="url" />
      </div>
    </div>
    <div class="row__right">
      ${geo === true ? `<button class="btn btn--primary btn-activar">Ubicar punto</button><button class="btn btn--ghost btn-ver">Ver punto</button>` : ``}
      <button class="btn btn--danger btn-eliminar">Limpiar</button>
      <div class="row__mini"><span>Punto: <b class="row-pt">—</b></span></div>
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
  rowEl.querySelector(".btn-activar")?.addEventListener("click", () => {
    activeRowId = rowId;
    pillActive.textContent = `Registro activo: ${rowId.slice(0,8)}…`;
    setStatus("Registro activo seleccionado. Haz clic en el mapa.", "info");
  });
  rowEl.querySelector(".btn-ver")?.addEventListener("click", () => {
    const pt = rowGeometries.get(rowId);
    if(pt) zoomToPoint(pt.lon, pt.lat);
  });
  rowEl.querySelector(".btn-eliminar")?.addEventListener("click", () => {
    rowGeometries.delete(rowId); rowMunicipio.delete(rowId); removeGraphicForRow(rowId);
    if(activeRowId === rowId){ activeRowId = null; pillActive.textContent = "Registro activo: —"; }
    rowEl.querySelector(".row-valor").value = ""; rowEl.querySelector(".row-obs").value = ""; rowEl.querySelector(".row-evi").value = "";
    if(rowEl.querySelector(".row-desc-sitio")) rowEl.querySelector(".row-desc-sitio").value = "";
    if(rowEl.querySelector(".row-mun")) rowEl.querySelector(".row-mun").value = "";
    if(rowEl.querySelector(".row-dane")) rowEl.querySelector(".row-dane").value = "";
    if(rowEl.querySelector(".row-pt")) rowEl.querySelector(".row-pt").textContent = "—";
  });
}

// ---------- Mapa ----------
function initMap(){
  return new Promise((resolve, reject) => {
    require([
      "esri/Map", "esri/views/MapView", "esri/layers/GraphicsLayer", "esri/layers/FeatureLayer",
      "esri/Graphic", "esri/widgets/Sketch/SketchViewModel", "esri/geometry/support/webMercatorUtils"
    ], (Map, MapView, GraphicsLayer, FeatureLayer, Graphic, SketchViewModel, _webMercatorUtils) => {
      webMercatorUtils = _webMercatorUtils;
      map = new Map({ basemap: "osm" });

      const jurisdiccionLayer = new FeatureLayer({
        url: `${CAR_SERVICE_URL}/${CAR_JUR_LAYER_ID}`, title: "Municipios CAR", opacity: 0.15, outFields: ["*"] 
      });
      map.add(jurisdiccionLayer);

      graphicsLayer = new GraphicsLayer({ title: "Puntos" });
      map.add(graphicsLayer);

      view = new MapView({ container: "map", map, center: [-74.2, 4.7], zoom: 8, popup: { dockEnabled: true, dockOptions: { position: "top-right", breakpoint: false } } });

      view.whenLayerView(jurisdiccionLayer).then((layerView) => { jurisdiccionLayerView = layerView; });

      sketchVM = new SketchViewModel({ view, layer: graphicsLayer, updateOnGraphicClick: false });

      sketchVM.on("update", async (evt) => {
        if(evt.state !== "complete") return;
        const g = evt.graphics?.[0]; if(!g || !g.attributes?.rowId) return;
        const geo = getGeographicLocation(g.geometry);
        rowGeometries.set(g.attributes.rowId, { lon: geo.longitude, lat: geo.latitude });
        document.querySelector(`.row[data-row-id="${g.attributes.rowId}"] .row-pt`).textContent = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
        await updateMunicipioFromCAR(g.attributes.rowId, geo.longitude, geo.latitude, g.geometry);
      });

      view.on("click", async (evt) => {
        if(!activeRowId){ setStatus("Primero activa un registro.", "error"); return; }
        const geo = getGeographicLocation(evt.mapPoint);
        rowGeometries.set(activeRowId, { lon: geo.longitude, lat: geo.latitude });
        const graphic = upsertGraphicForRow(activeRowId, geo.longitude, geo.latitude, Graphic);
        document.querySelector(`.row[data-row-id="${activeRowId}"] .row-pt`).textContent = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
        await updateMunicipioFromCAR(activeRowId, geo.longitude, geo.latitude, evt.mapPoint);
        if(graphic) sketchVM.update(graphic);
      });
      resolve(true);
    });
  });
}

// ---------- Construcción y Envío ----------
function collectDraft(){
  clearRowErrors();
  const actividadGid = elActividad.value;
  const vig = Number(elVigencia.value) || new Date().getFullYear();
  const periodo = elPeriodo.value;

  if(!actividadGid) throw new Error("Selecciona una actividad.");
  if(!periodo) throw new Error("Selecciona el periodo.");

  const avances = []; const rowsForUbic = []; const errors = [];
  const epochNow = Date.now();

  Array.from(document.querySelectorAll(".row")).forEach(rowEl => {
    const rowId = rowEl.getAttribute("data-row-id");
    const tareaGid = rowEl.getAttribute("data-tarea-gid");
    const label = rowEl.getAttribute("data-tarea-label") || "Tarea";
    const isGeo = rowEl.getAttribute("data-geo") === "1";
    const valStr = rowEl.querySelector(".row-valor")?.value;
    const obs = rowEl.querySelector(".row-obs")?.value.trim() || "";
    const evi = rowEl.querySelector(".row-evi")?.value.trim() || "";
    const descSitio = rowEl.querySelector(".row-desc-sitio")?.value.trim() || "";
    
    const pt = rowGeometries.get(rowId);
    const munInfo = rowMunicipio.get(rowId) || {};

    if(!valStr && !obs && !evi && !pt && !munInfo.municipioNombre && !descSitio) return; // Fila vacía

    if(!valStr) errors.push({rowEl, msg: `🔸 ${label}: falta Valor reportado.`});
    else if(isNaN(Number(valStr))) errors.push({rowEl, msg: `🔸 ${label}: Valor inválido.`});
    
    if(isGeo){
      if(!pt) errors.push({rowEl, msg: `🔸 ${label}: falta ubicar el punto.`});
      if(!munInfo.municipioNombre) errors.push({rowEl, msg: `🔸 ${label}: el punto debe estar dentro de la CAR.`});
    }

    avances.push({ attributes: {
      [F_AVA.fkTarea]: tareaGid, [F_AVA.vig]: vig, [F_AVA.per]: periodo,
      [F_AVA.val]: valStr ? Number(valStr) : null, [F_AVA.obs]: obs, [F_AVA.evi]: evi, 
      [F_AVA.fec]: epochNow, [F_AVA.resp]: currentResponsable
    }});
    rowsForUbic.push({ rowId, isGeo, descSitio, ...munInfo, pt });
  });

  const txt1 = elReporteNarrativo?.value.trim() || "";
  const txt2 = elDescLogros?.value.trim() || "";
  const txt3 = elPrincipalesLogros?.value.trim() || "";
  
  const narrativa = (txt1 || txt2 || txt3) ? { attributes: {
    [F_NAR.fkAct]: actividadGid, [F_NAR.vig]: vig, [F_NAR.per]: periodo,
    [F_NAR.txt1]: txt1, [F_NAR.txt2]: txt2, [F_NAR.txt3]: txt3, [F_NAR.fec]: epochNow,
    [F_NAR.resp]: currentResponsable
  }} : null;

  if(avances.length === 0 && !narrativa) throw new Error("Registra al menos un avance o texto narrativo.");
  if(errors.length){
    errors.forEach(e => markRowError(e.rowEl, e.msg));
    errors[0].rowEl.scrollIntoView({behavior:"smooth", block:"center"});
    throw new Error(`Hay errores en ${errors.length} tarea(s).`);
  }
  return { avances, rowsForUbic, narrativa };
}

async function saveDraft(draft){
  const epochNow = Date.now();
  
  // 1. Guardar Avances
  if (draft.avances.length > 0) {
    setStatus(`Guardando ${draft.avances.length} avance(s)…`);
    const resAv = await postForm(`${URL_AVANCE_TAREA}/applyEdits`, { f: "json", adds: draft.avances });
    if(resAv?.error) throw new Error(resAv.error.message);
    const failed = (resAv.addResults || []).filter(r => !r.success);
    if(failed.length) throw new Error(`Fallaron ${failed.length} avances.`);

    // 2. Guardar Ubicaciones
    const addsUbic = [];
    for(let i=0; i < resAv.addResults.length; i++){
      const ubic = draft.rowsForUbic[i];
      const globalIdAv = resAv.addResults[i]?.globalId; 
      if(!ubic || !ubic.isGeo || !globalIdAv) continue;

      addsUbic.push({
        attributes: {
          [F_UBI.fkAvance]: globalIdAv, 
          [F_UBI.dane]: ubic.codigoDANE, 
          [F_UBI.mun]: ubic.municipioNombre,
          [F_UBI.desc]: ubic.descSitio,
          [F_UBI.fec]: epochNow
        },
        geometry: { x: ubic.pt.lon, y: ubic.pt.lat, spatialReference: { wkid: 4326 } }
      });
    }

    if(addsUbic.length){
      setStatus(`Guardando ${addsUbic.length} ubicación(es)…`);
      const resUb = await postForm(`${URL_TAREA_UBICACION}/applyEdits`, { f:"json", adds: addsUbic });
      if(resUb?.error || !(resUb?.addResults || []).every(r=>r.success)) throw new Error("Error guardando geometrías.");
    }
  }

  // 3. Guardar Narrativa
  if(draft.narrativa){
    setStatus("Guardando reporte narrativo…");
    const resNar = await postForm(`${URL_NARRATIVA}/applyEdits`, { f:"json", adds: [draft.narrativa] });
    if(resNar?.error || !(resNar?.addResults || []).every(r=>r.success)) throw new Error("Error en narrativa.");
  }
}

// ---------- UI y Eventos ----------
function clearForm(){
  if(elReporteNarrativo) elReporteNarrativo.value = "";
  if(elDescLogros) elDescLogros.value = "";
  if(elPrincipalesLogros) elPrincipalesLogros.value = "";
  rowGeometries.clear(); clearMapGraphics(); activeRowId = null; pillActive.textContent = "Registro activo: —";
  elResponsable.textContent = "Responsable: —";
  currentResponsable = "";
  
  document.querySelectorAll(".row").forEach(r => {
    r.querySelector(".row-valor").value = ""; r.querySelector(".row-obs").value = ""; r.querySelector(".row-evi").value = "";
    if(r.querySelector(".row-desc-sitio")) r.querySelector(".row-desc-sitio").value = "";
    if(r.querySelector(".row-mun")) r.querySelector(".row-mun").value = "";
    if(r.querySelector(".row-dane")) r.querySelector(".row-dane").value = "";
    if(r.querySelector(".row-pt")) r.querySelector(".row-pt").textContent = "—";
  });
}

btnGuardar.addEventListener("click", async () => {
  try{ btnGuardar.disabled = true; await saveDraft(collectDraft()); setStatus("Datos sincronizados con éxito.", "success"); clearForm(); }
  catch(e){ console.error(e); setStatus(e.message, "error"); }
  finally{ btnGuardar.disabled = false; }
});
btnLimpiar.addEventListener("click", () => { clearForm(); setStatus("Formulario limpiado.", "info"); });
btnRefresh.addEventListener("click", loadActividades);
elVigencia.addEventListener("change", () => { loadActividades(); elIndicadores.innerHTML=""; });

// Evento: Al cambiar actividad, se extrae el código y se busca el Responsable
elActividad.addEventListener("change", async () => {
  const selectedOption = elActividad.options[elActividad.selectedIndex];
  const actividadGid = selectedOption.value;
  const actividadCod = selectedOption.getAttribute("data-codigo");
  const vig = Number(elVigencia.value) || new Date().getFullYear();

  if(actividadGid) {
    setStatus("Buscando responsable asignado...", "info");
    currentResponsable = await fetchResponsable(actividadCod, vig);
    elResponsable.textContent = currentResponsable ? `Responsable: ${currentResponsable}` : "Responsable: No asignado";
    await loadSubactividadesYTareas(actividadGid);
  } else {
    elResponsable.textContent = "Responsable: —";
    currentResponsable = "";
    elIndicadores.innerHTML = "";
  }
});

btnCentrar.addEventListener("click", () => { view.goTo({ center: [-74.2, 4.7], zoom: 8 }); });
btnLimpiarMapa.addEventListener("click", () => {
    clearMapGraphics();
    rowGeometries.clear();
    rowMunicipio.clear();
    document.querySelectorAll(".row").forEach(r => {
        if(r.querySelector(".row-mun")) r.querySelector(".row-mun").value = "";
        if(r.querySelector(".row-dane")) r.querySelector(".row-dane").value = "";
        if(r.querySelector(".row-pt")) r.querySelector(".row-pt").textContent = "—";
    });
});

// ---------- Inicio ----------
(async function main(){
  try{ await initMap(); await loadActividades(); }
  catch(e){ console.error(e); setStatus("Revisa la conexión a ArcGIS.", "error"); }
})();