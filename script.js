/* ===========================================================
   DATA-PAC | Formulario Reporte Trimestral (v0)
   Servicio: https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V0/FeatureServer
   Capa/Tabla:
     - REP_AvanceIndicador_PT (Layer 0)   -> applyEdits
     - CFG_Actividad (Table 6)           -> query
     - CFG_Indicador (Table 7)           -> query
     - REP_ReporteNarrativo (Table 11)   -> applyEdits
   =========================================================== */

const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V0/FeatureServer";
const URL_ACTIVIDAD = `${SERVICE_URL}/6`;
const URL_INDICADOR = `${SERVICE_URL}/7`;
const URL_AVANCE = `${SERVICE_URL}/0`;
const URL_NARRATIVA = `${SERVICE_URL}/11`;

// ---------- DOM ----------
const elActividad = document.getElementById("sel-actividad");
const elVigencia = document.getElementById("sel-vigencia");
const elPeriodo = document.getElementById("sel-periodo");
const elIndicadores = document.getElementById("indicadores");
const elNarrativa = document.getElementById("txt-narrativa");
const elStatus = document.getElementById("status");

const btnGuardar = document.getElementById("btn-guardar");
const btnLimpiar = document.getElementById("btn-limpiar");
const btnRefresh = document.getElementById("btn-refresh");
const btnLimpiarMapa = document.getElementById("btn-limpiar-mapa");
const btnCentrar = document.getElementById("btn-centrar");
const pillActive = document.getElementById("pill-active");

// ---------- State ----------
let municipiosDomain = null;   // {code: name}
let indicadoresCache = [];     // indicators for selected activity
let activeRowId = null;        // rowId armed for map click
let rowGeometries = new Map(); // rowId -> {lon,lat} wkid 4326

// Map
let map, view, graphicsLayer, webMercatorUtils;

// ---------- Helpers ----------
function setStatus(msg, type="info"){
  const prefix = type === "error" ? "❌ " : (type === "success" ? "✅ " : "ℹ️ ");
  elStatus.textContent = prefix + msg;
}

function escapeHtml(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function guidBraced(){
  const s = crypto.randomUUID().toUpperCase();
  return `{${s}}`;
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

async function loadServiceDomains(){
  const info = await fetchJson(SERVICE_URL, { f:"json" });
  const domains = info?.domains || [];
  const dm = {};
  for(const d of domains){
    if(d?.name && d?.codedValues){
      dm[d.name] = parseDomainValues(d);
    }
  }
  municipiosDomain = dm["DM_Municipio"] || null;
}

// ---------- Load activities ----------
async function loadActividades(){
  setStatus("Cargando actividades…");
  elActividad.innerHTML = `<option value="">Cargando…</option>`;

  const vig = Number(elVigencia.value) || new Date().getFullYear();

  const q = await fetchJson(`${URL_ACTIVIDAD}/query`, {
    f:"json",
    where: `Activo = 'SI' AND Vigencia = ${vig}`,
    outFields: "ActividadID,Nombre",
    orderByFields: "Nombre ASC",
    returnGeometry: "false"
  });

  const feats = q?.features || [];
  if(feats.length === 0){
    elActividad.innerHTML = `<option value="">No hay actividades para la vigencia ${vig}</option>`;
    setStatus("No se encontraron actividades (verifica Vigencia y datos en CFG_Actividad).", "error");
    return;
  }

  elActividad.innerHTML =
    `<option value="">— Selecciona una actividad —</option>` +
    feats.map(f => {
      const a = f.attributes;
      return `<option value="${escapeHtml(a.ActividadID)}">${escapeHtml(a.ActividadID)} — ${escapeHtml(a.Nombre)}</option>`;
    }).join("");

  setStatus("Actividades cargadas. Selecciona una para ver indicadores.", "success");
}

// ---------- Load indicators ----------
async function loadIndicadoresForActividad(actividadId){
  elIndicadores.innerHTML = "";
  indicadoresCache = [];
  rowGeometries.clear();
  activeRowId = null;
  pillActive.textContent = "Registro activo: —";
  clearMapGraphics();

  if(!actividadId) return;

  setStatus("Cargando indicadores…");
  const vig = Number(elVigencia.value) || new Date().getFullYear();

  const q = await fetchJson(`${URL_INDICADOR}/query`, {
    f:"json",
    where: `Activo = 'SI' AND Vigencia = ${vig} AND ActividadID = '${actividadId.replaceAll("'","''")}'`,
    outFields: "IndicadorID,ActividadID,CodigoIndicador,NombreIndicador,UnidadMedida,MetaAnual,PesoIndicador,MetodoCalculo,Vigencia",
    orderByFields: "CodigoIndicador ASC, NombreIndicador ASC",
    returnGeometry: "false"
  });

  const feats = q?.features || [];
  if(feats.length === 0){
    elIndicadores.innerHTML = `<div class="card"><div class="muted">No hay indicadores configurados para esta actividad y vigencia.</div></div>`;
    setStatus("No se encontraron indicadores (verifica CFG_Indicador).", "error");
    return;
  }

  indicadoresCache = feats.map(f => f.attributes);
  elIndicadores.innerHTML = indicadoresCache.map(ind => indicatorCardHtml(ind)).join("");
  wireIndicatorCardEvents();

  setStatus("Indicadores listos. Agrega municipios y ubica puntos en el mapa.", "success");
}

function indicatorCardHtml(ind){
  const code = ind.CodigoIndicador || "—";
  const meta = (ind.MetaAnual ?? "");
  const um = ind.UnidadMedida || "—";
  const peso = (ind.PesoIndicador ?? "");
  const metodo = ind.MetodoCalculo || "—";
  const safeId = String(ind.IndicadorID).replaceAll("{","").replaceAll("}","");

  return `
  <div class="card" data-indicador-id="${escapeHtml(ind.IndicadorID)}">
    <div class="card__top">
      <div>
        <p class="card__title">${escapeHtml(code)} — ${escapeHtml(ind.NombreIndicador)}</p>
        <div class="card__meta">
          <span>Unidad: <b>${escapeHtml(um)}</b></span>
          <span>Meta anual: <b>${escapeHtml(meta)}</b></span>
          <span>Peso: <b>${escapeHtml(peso)}</b></span>
          <span>Método: <b>${escapeHtml(metodo)}</b></span>
        </div>
      </div>
      <div class="badges">
        <span class="badge">Indicador</span>
        <span class="badge mono">${escapeHtml(ind.IndicadorID)}</span>
      </div>
    </div>

    <div class="rows" id="rows-${safeId}"></div>

    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
      <button class="btn btn--primary btn-add-row" data-indicador-id="${escapeHtml(ind.IndicadorID)}">+ Agregar municipio</button>
      <button class="btn btn--ghost btn-collapse" data-rows-id="rows-${safeId}">Contraer/expandir</button>
    </div>
  </div>`;
}

function municipioOptionsHtml(){
  if(!municipiosDomain){
    return `<option value="">(Dominio DM_Municipio no disponible)</option>`;
  }
  const opts = Object.entries(municipiosDomain)
    .sort((a,b)=> a[1].localeCompare(b[1], 'es'))
    .map(([code,name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)} (${escapeHtml(code)})</option>`)
    .join("");
  return `<option value="">— Selecciona municipio —</option>` + opts;
}

function indicatorById(indicadorId){
  return indicadoresCache.find(x => String(x.IndicadorID) === String(indicadorId));
}

function calcPorcAvance(valor, meta){
  const v = Number(valor);
  const m = Number(meta);
  if(!isFinite(v) || !isFinite(m) || m <= 0) return null;
  const p = (v / m) * 100.0;
  return Math.max(0, Math.min(100, p));
}

function makeRowHtml(indicadorId){
  const rowId = crypto.randomUUID();
  return `
  <div class="row" data-row-id="${rowId}" data-indicador-id="${escapeHtml(indicadorId)}">
    <div class="row__left">
      <div class="field" style="padding:0;">
        <label>Municipio</label>
        <select class="row-municipio">${municipioOptionsHtml()}</select>
      </div>

      <div class="field" style="padding:0;">
        <label>Valor ejecutado</label>
        <input class="row-valor" type="number" step="any" placeholder="Ej: 12" />
        <div class="row__mini">
          <span>Porc. avance estimado: <b class="row-porc">—</b></span>
        </div>
      </div>

      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Observaciones</label>
        <input class="row-obs" type="text" placeholder="Descripción corta del avance municipalizado…" />
      </div>

      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Evidencia (URL)</label>
        <input class="row-evi" type="url" placeholder="https://…" />
      </div>
    </div>

    <div class="row__right">
      <button class="btn btn--primary btn-activar" title="Activar este registro para ubicar punto en el mapa">Ubicar punto</button>
      <button class="btn btn--ghost btn-ver" title="Acercar el mapa al punto de este registro">Ver punto</button>
      <button class="btn btn--danger btn-eliminar" title="Eliminar este registro">Eliminar</button>
      <div class="row__mini">
        <span>Punto: <b class="row-pt">—</b></span>
      </div>
    </div>
  </div>`;
}

function wireIndicatorCardEvents(){
  document.querySelectorAll(".btn-add-row").forEach(btn => {
    btn.addEventListener("click", () => {
      const indicadorId = btn.getAttribute("data-indicador-id");
      const safeId = String(indicadorId).replaceAll("{","").replaceAll("}","");
      const container = document.getElementById(`rows-${safeId}`);
      container.insertAdjacentHTML("beforeend", makeRowHtml(indicadorId));
      wireRowEvents(container.lastElementChild);
    });
  });

  document.querySelectorAll(".btn-collapse").forEach(btn => {
    btn.addEventListener("click", () => {
      const rowsId = btn.getAttribute("data-rows-id");
      const container = document.getElementById(rowsId);
      container.style.display = (container.style.display === "none") ? "flex" : "none";
    });
  });
}

function wireRowEvents(rowEl){
  const rowId = rowEl.getAttribute("data-row-id");
  const indicadorId = rowEl.getAttribute("data-indicador-id");

  const inpVal = rowEl.querySelector(".row-valor");
  const elPorc = rowEl.querySelector(".row-porc");

  const btnAct = rowEl.querySelector(".btn-activar");
  const btnVer = rowEl.querySelector(".btn-ver");
  const btnDel = rowEl.querySelector(".btn-eliminar");

  const ind = indicatorById(indicadorId);

  inpVal.addEventListener("input", () => {
    const p = calcPorcAvance(inpVal.value, ind?.MetaAnual);
    elPorc.textContent = (p === null) ? "—" : `${p.toFixed(1)}%`;
  });

  btnAct.addEventListener("click", () => {
    activeRowId = rowId;
    pillActive.textContent = `Registro activo: ${rowId.slice(0,8)}…`;
    setStatus("Registro activo seleccionado. Ahora haz clic en el mapa para ubicar el punto.", "info");
  });

  btnVer.addEventListener("click", () => {
    const pt = rowGeometries.get(rowId);
    if(!pt){
      setStatus("Este registro aún no tiene punto.", "error");
      return;
    }
    zoomToPoint(pt.lon, pt.lat);
  });

  btnDel.addEventListener("click", () => {
    rowGeometries.delete(rowId);
    removeGraphicForRow(rowId);
    if(activeRowId === rowId){
      activeRowId = null;
      pillActive.textContent = "Registro activo: —";
    }
    rowEl.remove();
  });

  elPorc.textContent = "—";
}

// ---------- Map ----------
function initMap(){
  return new Promise((resolve, reject) => {
    require([
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/GraphicsLayer",
      "esri/Graphic",
      "esri/geometry/support/webMercatorUtils"
    ], (Map, MapView, GraphicsLayer, Graphic, _webMercatorUtils) => {
      webMercatorUtils = _webMercatorUtils;

      map = new Map({ basemap: "streets-navigation-vector" });
      graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

      view = new MapView({
        container: "map",
        map,
        center: [-74.2, 4.7],
        zoom: 8
      });

      view.on("click", (evt) => {
        if(!activeRowId){
          setStatus("Primero activa un registro con el botón “Ubicar punto”.", "error");
          return;
        }
        let g = evt.mapPoint;
        let geo = g;
        if (g.spatialReference && g.spatialReference.isWebMercator){
          geo = webMercatorUtils.webMercatorToGeographic(g);
        }
        const lon = geo.longitude;
        const lat = geo.latitude;

        rowGeometries.set(activeRowId, { lon, lat });
        upsertGraphicForRow(activeRowId, lon, lat);

        const rowEl = document.querySelector(`.row[data-row-id="${activeRowId}"]`);
        if(rowEl){
          rowEl.querySelector(".row-pt").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }

        setStatus("Punto asignado al registro activo.", "success");
      });

      btnLimpiarMapa.addEventListener("click", () => {
        rowGeometries.clear();
        clearMapGraphics();
        document.querySelectorAll(".row .row-pt").forEach(x => x.textContent = "—");
        setStatus("Se borraron todos los puntos.", "info");
      });

      btnCentrar.addEventListener("click", () => {
        view.goTo({ center: [-74.2, 4.7], zoom: 8 });
      });

      resolve();
    }, (err) => reject(err));
  });
}

function clearMapGraphics(){
  if(graphicsLayer) graphicsLayer.removeAll();
}

function upsertGraphicForRow(rowId, lon, lat){
  require(["esri/Graphic"], (Graphic) => {
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
      attributes: { rowId },
      popupTemplate: { title: "Avance municipalizado", content: `Registro: ${rowId}` }
    });
    graphicsLayer.add(graphic);
  });
}

function removeGraphicForRow(rowId){
  if(!graphicsLayer) return;
  const toRemove = graphicsLayer.graphics.filter(g => g?.attributes?.rowId === rowId);
  toRemove.forEach(g => graphicsLayer.remove(g));
}

function zoomToPoint(lon, lat){
  if(!view) return;
  view.goTo({ center: [lon, lat], zoom: 14 });
}

// ---------- Save ----------
function collectDraft(){
  const actividadId = elActividad.value;
  const vig = Number(elVigencia.value) || new Date().getFullYear();
  const periodo = elPeriodo.value;

  if(!actividadId){
    throw new Error("Selecciona una actividad.");
  }

  const avances = [];

  document.querySelectorAll(".row").forEach(rowEl => {
    const rowId = rowEl.getAttribute("data-row-id");
    const indicadorId = rowEl.getAttribute("data-indicador-id");
    const municipio = rowEl.querySelector(".row-municipio").value;
    const valor = rowEl.querySelector(".row-valor").value;
    const obs = rowEl.querySelector(".row-obs").value;
    const evi = rowEl.querySelector(".row-evi").value;

    const pt = rowGeometries.get(rowId);

    const hasAny = municipio || valor || obs || evi || pt;
    if(!hasAny) return;

    if(!municipio) throw new Error("Hay un registro sin Municipio. Selecciona el municipio o elimina el registro.");
    if(!pt) throw new Error("Hay un registro sin Punto. Activa el registro y ubica el punto en el mapa.");
    if(valor === "" || valor === null) throw new Error("Hay un registro sin Valor ejecutado.");

    const ind = indicatorById(indicadorId);
    const porc = calcPorcAvance(valor, ind?.MetaAnual);

    avances.push({
      attributes: {
        RegistroID: guidBraced(),
        IndicadorID: indicadorId,
        ActividadID: actividadId,
        Vigencia: vig,
        Periodo: periodo,
        ValorEjecutado: Number(valor),
        PorcAvance: (porc === null) ? null : porc,
        FechaRegistro: Date.now(),
        Municipio: municipio,
        Observaciones: obs || null,
        OrigenCarga: "WEB",
        PersonaID: null,
        EvidenciaURL: evi || null
      },
      geometry: {
        x: pt.lon,
        y: pt.lat,
        spatialReference: { wkid: 4326 }
      }
    });
  });

  if(avances.length === 0){
    throw new Error("No hay avances para guardar. Agrega al menos un municipio en un indicador.");
  }

  const narrativaTxt = elNarrativa.value?.trim() || "";
  const narrativa = narrativaTxt ? {
    attributes: {
      NarrativaID: guidBraced(),
      ActividadID: actividadId,
      Vigencia: vig,
      Periodo: periodo,
      TextoNarrativo: narrativaTxt,
      PersonaID: null,
      FechaRegistro: Date.now()
    }
  } : null;

  return { avances, narrativa };
}

async function saveDraft(draft){
  setStatus(`Guardando ${draft.avances.length} avance(s)…`);
  const resAv = await postForm(`${URL_AVANCE}/applyEdits`, {
    f: "json",
    adds: draft.avances
  });

  if(resAv?.error){
    throw new Error(resAv.error.message || "Error al guardar avances.");
  }
  const addResults = resAv?.addResults || [];
  const failed = addResults.filter(r => !r.success);
  if(failed.length){
    console.error("addResults", addResults);
    throw new Error(`Se guardaron con errores: ${failed.length} registro(s). Revisa consola.`);
  }

  if(draft.narrativa){
    setStatus("Guardando reporte narrativo…");
    const resNar = await postForm(`${URL_NARRATIVA}/applyEdits`, {
      f: "json",
      adds: [draft.narrativa]
    });
    if(resNar?.error){
      throw new Error(resNar.error.message || "Error al guardar narrativa.");
    }
    const narOK = (resNar?.addResults || []).every(r => r.success);
    if(!narOK){
      console.error("resNar", resNar);
      throw new Error("La narrativa no se guardó correctamente (revisa consola).");
    }
  }

  return true;
}

// ---------- UI ----------
function clearForm(){
  elNarrativa.value = "";
  document.querySelectorAll(".rows").forEach(c => c.innerHTML = "");
  rowGeometries.clear();
  clearMapGraphics();
  activeRowId = null;
  pillActive.textContent = "Registro activo: —";
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
  await loadIndicadoresForActividad(elActividad.value);
});

elVigencia.addEventListener("change", async () => {
  await loadActividades();
  await loadIndicadoresForActividad(elActividad.value);
});

// ---------- Bootstrap ----------
async function bootstrap(forceReload=false){
  try{
    if(forceReload) municipiosDomain = null;
    setStatus("Inicializando…");
    await loadServiceDomains();
    await loadActividades();
    setStatus("Listo.", "success");
  }catch(e){
    console.error(e);
    setStatus("Error inicializando la app. Revisa la consola.", "error");
  }
}

(async function main(){
  try{
    await initMap();
    await bootstrap(false);
  }catch(e){
    console.error(e);
    setStatus("No se pudo inicializar el mapa. Revisa conexión y consola.", "error");
  }
})();