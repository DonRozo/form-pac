/* ===========================================================
   DATA-PAC | Reporte Trimestral (v2)
   Esquema: Estricto según definición JSON
   Mejoras: Login OTP + Filtrado Automático por Persona
   =========================================================== */

// --- Servicio ---
const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V2/FeatureServer";
const CAR_SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/MpiosCAR/FeatureServer";
const CAR_JUR_LAYER_ID = 0; 

// --- Configuración Power Automate ---
// ⚠️ PEGA AQUÍ LA URL HTTP DE TU FLUJO DE POWER AUTOMATE:
const URL_WEBHOOK_POWERAUTOMATE = "https://default64f30d63182749d899511db17d0949.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/1123b3fd4a854b40b2b22dd45b03ca7c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Qz68D2G5RAq9cmMvOew1roy8bD3YQPtju4KPW2vEtvc"; 

// Índices
const URL_ACTIVIDAD = `${SERVICE_URL}/6`;
const URL_SUBACTIVIDAD = `${SERVICE_URL}/7`;
const URL_TAREA = `${SERVICE_URL}/8`;
const URL_AVANCE_TAREA = `${SERVICE_URL}/9`;
const URL_TAREA_UBICACION = `${SERVICE_URL}/10`; 
const URL_NARRATIVA = `${SERVICE_URL}/11`;
const URL_ASIGNACION = `${SERVICE_URL}/15`; 
const URL_PERSONA = `${SERVICE_URL}/16`; 
const URL_OTP = `${SERVICE_URL}/17`; 

// Mapeo Estricto de Campos
const F_ACT = { gid: "GlobalID", id: "ActividadID", nom: "NombreActividad", vig: "Vigencia", act: "Activo" };
const F_SUB = { gid: "GlobalID", fkAct: "ActividadGlobalID", id: "CodigoSubActividad", nom: "NombreSubActividad" };
const F_TAR = { gid: "GlobalID", fkSub: "SubActividadGlobalID", id: "CodigoTarea", nom: "NombreTarea", um: "UnidadMedida", geo: "EsGeorreferenciable" };
const F_AVA = { fkTarea: "TareaGlobalID", vig: "Vigencia", per: "Periodo", val: "ValorReportado", obs: "Observaciones", evi: "EvidenciaURL", fec: "FechaRegistro", resp: "Responsable" };
const F_UBI = { fkAvance: "AvanceTareaGlobalID", dane: "CodigoDANE", mun: "MunicipioNombre", desc: "DescripcionSitio", fec: "FechaRegistro" };
const F_NAR = { fkAct: "ActividadGlobalID", vig: "Vigencia", per: "Periodo", txt1: "TextoNarrativo", txt2: "DescripcionLogrosAlcanzados", txt3: "PrincipalesLogros", fec: "FechaRegistro", resp: "Responsable" };
const F_ASIG = { fkPers: "PersonaGlobalID", actId: "ActividadID", vig: "Vigencia", act: "Activo" };
const F_PERS = { gid: "GlobalID", nom: "Nombre", act: "Activo" };
const F_OTP = { gid: "GlobalID", hash: "CodigoHash", correo: "Correo", usado: "Usado", fkPers: "PersonaGlobalID" };

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
const pillActive = document.getElementById("pill-active");

// ---------- State ----------
let cacheSubactividades = [];         
let cacheTareas = [];                 
let activeRowId = null;               
let rowLocations = new Map();         
let currentUser = null; // Guardará { gid, nombre, correo }

// Map
let map, view, graphicsLayer, webMercatorUtils, sketchVM;
let jurisdiccionLayerView = null; 

// ---------- Helpers Generales ----------
function setStatus(msg, type="info"){
  const prefix = type === "error" ? "❌ " : (type === "success" ? "✅ " : "ℹ️ ");
  elStatus.textContent = prefix + msg;
}
function escapeHtml(s){ return (s ?? "").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function normalize(s){ return (s||"").toString().toLowerCase(); }
function toYesNo(v){
  const s = normalize(v);
  if(s === "si" || s === "sí" || s === "1" || s === "true") return true;
  if(s === "no" || s === "0" || s === "false") return false;
  return null;
}
async function fetchJson(url, params){
  const u = new URL(url); Object.entries(params || {}).forEach(([k,v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString(), { method: "GET" });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
async function postForm(url, formObj){
  const form = new URLSearchParams();
  Object.entries(formObj).forEach(([k,v]) => { if(v!=null) form.append(k, typeof v==="string"?v:JSON.stringify(v)); });
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if(!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json();
}

// ---------- Lógica de Autenticación (OTP) ----------
const loginOverlay = document.getElementById("login-overlay");
const btnSolicitar = document.getElementById("btn-solicitar-codigo");
const btnValidar = document.getElementById("btn-validar-codigo");
const msg1 = document.getElementById("login-msg-1");
const msg2 = document.getElementById("login-msg-2");

btnSolicitar.addEventListener("click", async () => {
  const cedula = document.getElementById("login-cedula").value.trim();
  const correo = document.getElementById("login-correo").value.trim().toLowerCase();
  
  if(!cedula || !correo){ msg1.textContent = "Ingresa cédula y correo."; return; }
  
  btnSolicitar.disabled = true;
  btnSolicitar.textContent = "Buscando...";
  msg1.textContent = "";

  try {
    const res = await fetch(URL_WEBHOOK_POWERAUTOMATE, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula, correo })
    });
    
    if(res.status === 200) {
      document.getElementById("login-step-1").classList.remove("active");
      document.getElementById("login-step-2").classList.add("active");
    } else {
      msg1.textContent = "Credenciales inválidas o usuario inactivo.";
    }
  } catch(e) {
    console.error(e);
    msg1.textContent = "Error conectando con el sistema de validación.";
  } finally {
    btnSolicitar.disabled = false;
    btnSolicitar.textContent = "Solicitar Código";
  }
});

btnValidar.addEventListener("click", async () => {
  const correo = document.getElementById("login-correo").value.trim().toLowerCase();
  const codigo = document.getElementById("login-codigo").value.trim();
  
  if(codigo.length !== 6){ msg2.textContent = "Ingresa los 6 dígitos."; return; }
  
  btnValidar.disabled = true;
  btnValidar.textContent = "Verificando...";
  msg2.textContent = "";

  try {
    // 1. Buscar OTP no usado
    const qOtp = await fetchJson(`${URL_OTP}/query`, {
      f: "json", where: `${F_OTP.correo} = '${correo}' AND ${F_OTP.hash} = '${codigo}' AND ${F_OTP.usado} = 'NO'`,
      outFields: "*", returnGeometry: false
    });

    if(!qOtp.features || qOtp.features.length === 0){
      msg2.textContent = "Código incorrecto o ya utilizado.";
      btnValidar.disabled = false; btnValidar.textContent = "Verificar y Entrar";
      return;
    }

    const otpRecord = qOtp.features[0].attributes;
    const personaGid = otpRecord[F_OTP.fkPers];
    const otpOid = otpRecord["OBJECTID"];

    // 2. Traer Nombre de la Persona
    const qPers = await fetchJson(`${URL_PERSONA}/query`, {
      f: "json", where: `${F_PERS.gid} = '${personaGid}'`, outFields: F_PERS.nom, returnGeometry: false
    });
    const nombre = qPers.features[0]?.attributes[F_PERS.nom] || "Usuario";

    // 3. Quemar el código (Marcar como Usado)
    await postForm(`${URL_OTP}/applyEdits`, {
      f: "json", updates: [{ attributes: { "OBJECTID": otpOid, [F_OTP.usado]: "SI" } }]
    });

    // 4. Ingreso Exitoso
    currentUser = { gid: personaGid, nombre, correo };
    elResponsable.textContent = `Responsable: ${currentUser.nombre}`;
    loginOverlay.style.display = "none";
    
    // Iniciar Mapa y Cargar Actividades del usuario
    await initMap();
    await loadActividades();

  } catch(e) {
    console.error(e);
    msg2.textContent = "Error al validar el código.";
    btnValidar.disabled = false; btnValidar.textContent = "Verificar y Entrar";
  }
});

// ---------- Geometría y Mapa ----------
function clearMapGraphics(){ if(graphicsLayer) graphicsLayer.removeAll(); }
function removeGraphicForPoint(ptId){ if(graphicsLayer) graphicsLayer.graphics.filter(g => g?.attributes?.ptId === ptId).forEach(g => graphicsLayer.remove(g)); }
function removeAllGraphicsForRow(rowId){ if(graphicsLayer) graphicsLayer.graphics.filter(g => g?.attributes?.rowId === rowId).forEach(g => graphicsLayer.remove(g)); }
function addGraphicForPoint(rowId, ptId, lon, lat, Graphic){
  removeGraphicForPoint(ptId);
  const graphic = new Graphic({
    geometry: { type: "point", longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } },
    symbol: { type: "simple-marker", style: "circle", color: [23,151,209,0.9], size: 10, outline: { color: [11,82,105,1], width: 2 } },
    attributes: { rowId, ptId }
  });
  graphicsLayer.add(graphic); return graphic;
}
function getGeographicLocation(p) { return (p.spatialReference && p.spatialReference.isWebMercator && webMercatorUtils) ? webMercatorUtils.webMercatorToGeographic(p) : p; }

function deleteLocation(rowId, ptId) {
  removeGraphicForPoint(ptId);
  const locs = rowLocations.get(rowId) || [];
  rowLocations.set(rowId, locs.filter(l => l.ptId !== ptId));
  const el = document.getElementById(`loc-${ptId}`); if(el) el.remove();
}

function appendLocationUI(rowId, ptId, lon, lat) {
  const listEl = document.getElementById(`loc-list-${rowId}`); if(!listEl) return;
  const div = document.createElement("div"); div.className = "loc-item"; div.id = `loc-${ptId}`;
  div.innerHTML = `
    <div class="loc-item__header"><span>📍 Sitio: <span class="loc-coords">${lat.toFixed(5)}, ${lon.toFixed(5)}</span></span><button class="btn-loc-del" title="Eliminar">Eliminar</button></div>
    <div class="field" style="padding:0;"><input class="loc-desc" type="text" placeholder="Descripción del sitio (Ej: Vereda...)" /></div>
    <div class="loc-item__grid">
      <div class="field" style="padding:0;"><input class="loc-mun" type="text" placeholder="Calculando Municipio..." readonly /></div>
      <div class="field" style="padding:0;"><input class="loc-dane" type="text" placeholder="Calculando DANE..." readonly /></div>
    </div>`;
  div.querySelector(".btn-loc-del").addEventListener("click", () => deleteLocation(rowId, ptId));
  listEl.appendChild(div);
}

async function updateMunicipioFromCAR(rowId, ptId, mapPoint){
  if (!jurisdiccionLayerView) return;
  try{
    document.body.style.cursor = 'wait';
    const query = { geometry: mapPoint, spatialRelationship: "intersects", returnGeometry: false, outFields: ["*"] };
    const result = await jurisdiccionLayerView.queryFeatures(query);
    const feats = result.features || [];

    const locEl = document.getElementById(`loc-${ptId}`); if(!locEl) return;
    const munEl = locEl.querySelector(".loc-mun"); const daneEl = locEl.querySelector(".loc-dane");

    if(!feats.length){
      if(munEl) munEl.value = "Fuera de CAR"; if(daneEl) daneEl.value = "N/A";
      view.popup.open({ title: "Fuera de jurisdicción", content: "Este punto no está dentro de la CAR.", location: mapPoint });
      return;
    }

    const a = feats[0].attributes || {}; const keys = Object.keys(a);
    const munKey = keys.find(k => normalize(k).includes("municipio") || normalize(k).includes("mpio"));
    const daneKey = keys.find(k => normalize(k).includes("dane"));
    const mun = munKey ? a[munKey] : ""; const dane = daneKey ? String(a[daneKey]) : "";

    if(munEl) munEl.value = mun; if(daneEl) daneEl.value = dane;
    const locs = rowLocations.get(rowId) || []; const locObj = locs.find(l => l.ptId === ptId);
    if(locObj) { locObj.mun = mun; locObj.dane = dane; }
    view.popup.close();
  }catch(e){ console.error(e); }finally{ document.body.style.cursor = 'default'; }
}

// ---------- Carga de Datos Filtrada ----------
async function loadActividades(){
  if(!currentUser) return;
  setStatus("Buscando actividades asignadas…");
  elActividad.innerHTML = `<option value="">Cargando…</option>`;
  const vig = Number(elVigencia.value) || new Date().getFullYear();

  // 1. Buscar qué ActividadID tiene asignados esta persona
  const qAsig = await fetchJson(`${URL_ASIGNACION}/query`, {
    f: "json", where: `${F_ASIG.fkPers} = '${currentUser.gid}' AND ${F_ASIG.vig} = ${vig} AND ${F_ASIG.act} = 'SI'`,
    outFields: F_ASIG.actId, returnGeometry: false
  });

  const idsAsignados = (qAsig.features || []).map(f => f.attributes[F_ASIG.actId]).filter(Boolean);
  
  if(idsAsignados.length === 0) {
    elActividad.innerHTML = `<option value="">No tienes actividades asignadas en ${vig}</option>`;
    setStatus("Sin asignaciones.", "error"); return;
  }

  // 2. Traer esas actividades específicas
  const inList = idsAsignados.map(id => `'${id}'`).join(",");
  const qAct = await fetchJson(`${URL_ACTIVIDAD}/query`, {
    f: "json", where: `${F_ACT.id} IN (${inList}) AND ${F_ACT.act} = 'SI' AND ${F_ACT.vig} = ${vig}`,
    outFields: `${F_ACT.gid},${F_ACT.id},${F_ACT.nom}`, orderByFields: `${F_ACT.id} ASC`, returnGeometry: false
  });

  const feats = qAct?.features || [];
  if(feats.length === 0){
    elActividad.innerHTML = `<option value="">Tus actividades no están activas en catálogo</option>`;
    setStatus("Actividades no encontradas.", "error"); return;
  }

  elActividad.innerHTML = `<option value="">— Selecciona una actividad —</option>` +
    feats.map(f => {
      const a = f.attributes || {};
      const label = (a[F_ACT.id] ? `${a[F_ACT.id]} — ` : "") + (a[F_ACT.nom] || a[F_ACT.gid]);
      return `<option value="${escapeHtml(a[F_ACT.gid])}" data-codigo="${escapeHtml(a[F_ACT.id])}">${escapeHtml(label)}</option>`;
    }).join("");

  setStatus("Tus actividades fueron cargadas correctamente.", "success");
}

async function loadSubactividadesYTareas(actividadGlobalId){
  elIndicadores.innerHTML = ""; cacheSubactividades = []; cacheTareas = [];
  rowLocations.clear(); activeRowId = null; pillActive.textContent = "Registro activo: —"; clearMapGraphics();

  if(!actividadGlobalId) return;
  setStatus("Cargando estructura de tareas…");

  const subQ = await fetchJson(`${URL_SUBACTIVIDAD}/query`, {
    f: "json", where: `${F_SUB.fkAct} = '${actividadGlobalId}'`,
    outFields: "*", orderByFields: `${F_SUB.id} ASC`, returnGeometry: "false"
  });
  cacheSubactividades = (subQ.features || []).map(f => f.attributes || {});

  const subIds = cacheSubactividades.map(s => s[F_SUB.gid]).filter(Boolean);
  if(subIds.length === 0){ setStatus("No se encontraron subactividades.", "error"); return; }

  const inList = subIds.map(x => `'${x}'`).join(",");
  const tareaQ = await fetchJson(`${URL_TAREA}/query`, {
    f: "json", where: `${F_TAR.fkSub} IN (${inList})`, outFields: "*", orderByFields: `${F_TAR.id} ASC`, returnGeometry: "false"
  });
  cacheTareas = (tareaQ.features || []).map(f => f.attributes || {});

  elIndicadores.innerHTML = cacheSubactividades.map(sa => subActividadCardHtml(sa)).join("");
  wireCardEvents();
  setStatus("Formulario de tareas listo.", "success");
}

function subActividadCardHtml(sa){
  const gid = sa[F_SUB.gid]; const cod = sa[F_SUB.id] || ""; const nom = sa[F_SUB.nom] || "";
  const title = (cod ? `${cod} — ` : "") + (nom || gid);
  const safeId = String(gid).replaceAll("{","").replaceAll("}","").replaceAll("-","");
  return `
  <div class="card" data-subgid="${escapeHtml(gid)}">
    <div class="card__top"><div><p class="card__title">${escapeHtml(title)}</p></div></div>
    <div class="rows" id="rows-${safeId}">${tareasRowsHtml(gid)}</div>
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
  const gid = t[F_TAR.gid]; const cod = t[F_TAR.id] || ""; const nom = t[F_TAR.nom] || "";
  const um = t[F_TAR.um] || ""; const geo = toYesNo(t[F_TAR.geo]);
  rowLocations.set(rowId, []);

  return `
  <div class="row" data-row-id="${rowId}" data-tarea-gid="${escapeHtml(gid)}" data-tarea-label="${escapeHtml((cod || nom || gid))}" data-geo="${geo === true ? "1" : "0"}">
    <div class="row__left">
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Tarea</label>
        <div class="mono" style="font-size:12px; margin-bottom:6px;">${escapeHtml(cod)} ${cod?"—":""} ${escapeHtml(nom)}</div>
        <div class="row__mini">${um ? `<span>UM: <b>${escapeHtml(um)}</b></span>` : ``}<span>Mpio: <b>${geo === true ? "SI" : "NO"}</b></span></div>
      </div>
      <div class="field" style="padding:0;"><label>Valor reportado</label><input class="row-valor" type="number" step="any" /></div>
      <div class="field" style="padding:0; grid-column: 1 / span 2;"><label>Observaciones</label><input class="row-obs" type="text" /></div>
      <div class="field" style="padding:0; grid-column: 1 / span 2;"><label>Evidencia (URL)</label><input class="row-evi" type="url" /></div>
      ${geo === true ? `<div class="loc-list" id="loc-list-${rowId}"></div>` : ``}
    </div>
    <div class="row__right">
      ${geo === true ? `<button class="btn btn--primary btn-activar">Ubicar punto(s)</button>` : ``}
      <button class="btn btn--danger btn-eliminar">Limpiar Fila</button>
    </div>
  </div>`;
}

function wireCardEvents(){
  document.querySelectorAll(".btn-collapse").forEach(btn => {
    btn.addEventListener("click", () => {
      const rowsId = btn.getAttribute("data-rows-id"); const container = document.getElementById(rowsId);
      container.style.display = (container.style.display === "none") ? "flex" : "none";
    });
  });
  document.querySelectorAll(".row").forEach(rowEl => wireRowEvents(rowEl));
}

function wireRowEvents(rowEl){
  const rowId = rowEl.getAttribute("data-row-id");
  rowEl.querySelector(".btn-activar")?.addEventListener("click", () => {
    activeRowId = rowId; pillActive.textContent = `Registro activo: ${rowId.slice(0,8)}…`;
    setStatus("Registro activo seleccionado. Haz clic en el mapa.", "info");
  });
  rowEl.querySelector(".btn-eliminar")?.addEventListener("click", () => {
    removeAllGraphicsForRow(rowId); rowLocations.set(rowId, []);
    const locList = document.getElementById(`loc-list-${rowId}`); if(locList) locList.innerHTML = "";
    if(activeRowId === rowId){ activeRowId = null; pillActive.textContent = "Registro activo: —"; }
    rowEl.querySelector(".row-valor").value = ""; rowEl.querySelector(".row-obs").value = ""; rowEl.querySelector(".row-evi").value = "";
  });
}

// ---------- Mapa ----------
function initMap(){
  return new Promise((resolve, reject) => {
    require([
      "esri/Map", "esri/views/MapView", "esri/layers/GraphicsLayer", "esri/layers/FeatureLayer",
      "esri/Graphic", "esri/widgets/Sketch/SketchViewModel", "esri/geometry/support/webMercatorUtils",
      "esri/widgets/Search", "esri/widgets/BasemapGallery", "esri/widgets/Expand"
    ], (Map, MapView, GraphicsLayer, FeatureLayer, Graphic, SketchViewModel, _webMercatorUtils, Search, BasemapGallery, Expand) => {
      webMercatorUtils = _webMercatorUtils;
      map = new Map({ basemap: "osm" });
      const jurisdiccionLayer = new FeatureLayer({ url: `${CAR_SERVICE_URL}/${CAR_JUR_LAYER_ID}`, title: "Municipios CAR", opacity: 0.15, outFields: ["*"] });
      map.add(jurisdiccionLayer);
      graphicsLayer = new GraphicsLayer({ title: "Puntos" }); map.add(graphicsLayer);
      view = new MapView({ container: "map", map, center: [-74.2, 4.7], zoom: 8, popup: { dockEnabled: true, dockOptions: { position: "top-right", breakpoint: false } } });

      view.ui.add(new Search({ view: view }), "top-right");
      view.ui.add(new Expand({ view: view, content: new BasemapGallery({ view: view, container: document.createElement("div") }), expandIcon: "basemap" }), "top-left");

      view.whenLayerView(jurisdiccionLayer).then((layerView) => { jurisdiccionLayerView = layerView; });
      sketchVM = new SketchViewModel({ view, layer: graphicsLayer, updateOnGraphicClick: false });

      sketchVM.on("update", async (evt) => {
        if(evt.state !== "complete") return;
        const g = evt.graphics?.[0]; if(!g || !g.attributes?.rowId || !g.attributes?.ptId) return;
        const geo = getGeographicLocation(g.geometry);
        const rId = g.attributes.rowId; const pId = g.attributes.ptId;
        const locs = rowLocations.get(rId) || []; const locObj = locs.find(l => l.ptId === pId);
        if(locObj){ locObj.lon = geo.longitude; locObj.lat = geo.latitude; const el = document.getElementById(`loc-${pId}`); if(el) el.querySelector('.loc-coords').textContent = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`; }
        await updateMunicipioFromCAR(rId, pId, g.geometry);
      });

      view.on("click", async (evt) => {
        if(!activeRowId){ setStatus("Activa un registro en el panel.", "error"); return; }
        const geo = getGeographicLocation(evt.mapPoint);
        const ptId = crypto.randomUUID(); const locs = rowLocations.get(activeRowId) || [];
        locs.push({ ptId, lon: geo.longitude, lat: geo.latitude, mun: "", dane: "", desc: "" }); rowLocations.set(activeRowId, locs);
        addGraphicForPoint(activeRowId, ptId, geo.longitude, geo.latitude, Graphic);
        appendLocationUI(activeRowId, ptId, geo.longitude, geo.latitude);
        await updateMunicipioFromCAR(activeRowId, ptId, evt.mapPoint);
      });
      resolve(true);
    });
  });
}

// ---------- Construcción y Envío ----------
function collectDraft(){
  const actividadGid = elActividad.value; const vig = Number(elVigencia.value) || new Date().getFullYear(); const periodo = elPeriodo.value;
  if(!actividadGid || !periodo) throw new Error("Revisa Actividad y Periodo.");

  const avances = []; const rowsForUbic = []; const epochNow = Date.now();
  Array.from(document.querySelectorAll(".row")).forEach(rowEl => {
    const rowId = rowEl.getAttribute("data-row-id"); const tareaGid = rowEl.getAttribute("data-tarea-gid"); const isGeo = rowEl.getAttribute("data-geo") === "1";
    const valStr = rowEl.querySelector(".row-valor")?.value; const obs = rowEl.querySelector(".row-obs")?.value.trim() || ""; const evi = rowEl.querySelector(".row-evi")?.value.trim() || "";
    
    let validLocations = [];
    if (isGeo) {
      const savedLocs = rowLocations.get(rowId) || [];
      savedLocs.forEach(loc => { const domLoc = document.getElementById(`loc-${loc.ptId}`); if(domLoc) { loc.desc = domLoc.querySelector(".loc-desc").value.trim(); } validLocations.push(loc); });
    }
    if(!valStr && !obs && !evi && validLocations.length === 0) return; 

    avances.push({ attributes: {
      [F_AVA.fkTarea]: tareaGid, [F_AVA.vig]: vig, [F_AVA.per]: periodo, [F_AVA.val]: valStr ? Number(valStr) : null, [F_AVA.obs]: obs, [F_AVA.evi]: evi, 
      [F_AVA.fec]: epochNow, [F_AVA.resp]: currentUser.nombre // INYECCIÓN DEL USUARIO LOGUEADO
    }});
    rowsForUbic.push({ rowId, isGeo, locations: validLocations });
  });

  const txt1 = elReporteNarrativo?.value.trim() || ""; const txt2 = elDescLogros?.value.trim() || ""; const txt3 = elPrincipalesLogros?.value.trim() || "";
  const narrativa = (txt1 || txt2 || txt3) ? { attributes: {
    [F_NAR.fkAct]: actividadGid, [F_NAR.vig]: vig, [F_NAR.per]: periodo, [F_NAR.txt1]: txt1, [F_NAR.txt2]: txt2, [F_NAR.txt3]: txt3, [F_NAR.fec]: epochNow,
    [F_NAR.resp]: currentUser.nombre // INYECCIÓN DEL USUARIO LOGUEADO
  }} : null;

  if(avances.length === 0 && !narrativa) throw new Error("No hay datos para guardar.");
  return { avances, rowsForUbic, narrativa };
}

async function saveDraft(draft){
  const epochNow = Date.now();
  if (draft.avances.length > 0) {
    setStatus(`Guardando...`);
    const resAv = await postForm(`${URL_AVANCE_TAREA}/applyEdits`, { f: "json", adds: draft.avances });
    const addsUbic = [];
    for(let i=0; i < resAv.addResults.length; i++){
      const ubicData = draft.rowsForUbic[i]; const globalIdAv = resAv.addResults[i]?.globalId; 
      if(!ubicData || !ubicData.isGeo || !globalIdAv) continue;
      for(const pt of ubicData.locations) {
        addsUbic.push({
          attributes: { [F_UBI.fkAvance]: globalIdAv, [F_UBI.dane]: pt.dane, [F_UBI.mun]: pt.mun, [F_UBI.desc]: pt.desc, [F_UBI.fec]: epochNow },
          geometry: { x: pt.lon, y: pt.lat, spatialReference: { wkid: 4326 } }
        });
      }
    }
    if(addsUbic.length){ await postForm(`${URL_TAREA_UBICACION}/applyEdits`, { f:"json", adds: addsUbic }); }
  }
  if(draft.narrativa){ await postForm(`${URL_NARRATIVA}/applyEdits`, { f:"json", adds: [draft.narrativa] }); }
}

function clearForm(){
  if(elReporteNarrativo) elReporteNarrativo.value = ""; if(elDescLogros) elDescLogros.value = ""; if(elPrincipalesLogros) elPrincipalesLogros.value = "";
  rowLocations.clear(); clearMapGraphics(); activeRowId = null; pillActive.textContent = "Registro activo: —";
  document.querySelectorAll(".row").forEach(r => {
    r.querySelector(".row-valor").value = ""; r.querySelector(".row-obs").value = ""; r.querySelector(".row-evi").value = "";
    const locList = r.querySelector(".loc-list"); if(locList) locList.innerHTML = "";
  });
}

btnGuardar.addEventListener("click", async () => { try{ btnGuardar.disabled = true; await saveDraft(collectDraft()); setStatus("Datos sincronizados.", "success"); clearForm(); } catch(e){ console.error(e); setStatus(e.message, "error"); } finally{ btnGuardar.disabled = false; }});
btnLimpiar.addEventListener("click", () => { clearForm(); setStatus("Limpio.", "info"); });
btnRefresh.addEventListener("click", loadActividades);
elVigencia.addEventListener("change", () => { loadActividades(); elIndicadores.innerHTML=""; });
elActividad.addEventListener("change", async () => {
  const selectedOption = elActividad.options[elActividad.selectedIndex];
  if(selectedOption.value) await loadSubactividadesYTareas(selectedOption.value);
  else elIndicadores.innerHTML = "";
});
document.getElementById("btn-centrar").addEventListener("click", () => { view.goTo({ center: [-74.2, 4.7], zoom: 8 }); });
document.getElementById("btn-limpiar-mapa").addEventListener("click", () => {
    clearMapGraphics(); rowLocations.clear(); document.querySelectorAll(".loc-list").forEach(l => l.innerHTML = "");
});