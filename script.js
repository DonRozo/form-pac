/* ===========================================================
   DATA-PAC | Formulario Reporte Trimestral (v2)
   Servicio: DATAPAC_V2
   =========================================================== */

const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V2/FeatureServer";

const IDX = {
  CFG_Actividad: 6,
  CFG_SubActividad: 7,
  CFG_Tarea: 8,
  REP_AvanceTarea: 9,
  REP_TareaUbicacion_PT: 10,
  REP_ReporteNarrativo: 11
};

const URL = {
  ACT: `${SERVICE_URL}/${IDX.CFG_Actividad}`,
  SUB: `${SERVICE_URL}/${IDX.CFG_SubActividad}`,
  TAR: `${SERVICE_URL}/${IDX.CFG_Tarea}`,
  AVT: `${SERVICE_URL}/${IDX.REP_AvanceTarea}`,
  UB:  `${SERVICE_URL}/${IDX.REP_TareaUbicacion_PT}`,
  NAR: `${SERVICE_URL}/${IDX.REP_ReporteNarrativo}`
};

// ---------- DOM ----------
const elActividad = document.getElementById("sel-actividad");
const elVigencia = document.getElementById("sel-vigencia");
const elPeriodo = document.getElementById("sel-periodo");
const elSubacts = document.getElementById("subactividades");
const elNarrativa = document.getElementById("txt-narrativa");
const elStatus = document.getElementById("status");

const btnGuardar = document.getElementById("btn-guardar");
const btnLimpiar = document.getElementById("btn-limpiar");
const btnRefresh = document.getElementById("btn-refresh");
const btnLimpiarMapa = document.getElementById("btn-limpiar-mapa");
const btnCentrar = document.getElementById("btn-centrar");
const pillActive = document.getElementById("pill-active");

// ---------- State ----------
let municipiosDomain = null;
const tableInfo = new Map();

let actividadInfo = null;
let subactInfo = null;
let tareaInfo = null;
let avanceInfo = null;
let ubicInfo = null;
let narrativaInfo = null;

let subactsCache = [];
let tareasCache = [];
const tareasBySub = new Map();

let activeRowId = null;
const rowGeometries = new Map();

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

function pickFieldName(fields, candidates){
  const set = new Set((fields||[]).map(f => f.name));
  for(const c of candidates){
    if(set.has(c)) return c;
  }
  return null;
}

function getAttr(a, candidates){
  for(const c of candidates){
    if(a && Object.prototype.hasOwnProperty.call(a, c) && a[c] !== undefined && a[c] !== null) return a[c];
  }
  return null;
}

function normYes(v){
  if(v === true) return true;
  if(v === false) return false;
  if(v === null || v === undefined) return false;
  const s = String(v).trim().toUpperCase();
  return (s === "SI" || s === "S" || s === "1" || s === "TRUE" || s === "T" || s === "Y" || s === "YES");
}

// ---------- Metadata ----------
async function loadTableMeta(url){
  if(tableInfo.has(url)) return tableInfo.get(url);
  const meta = await fetchJson(url, { f:"json" });
  tableInfo.set(url, meta);
  return meta;
}

async function bootstrapMeta(){
  const [mAct,mSub,mTar,mAvt,mUb,mNar] = await Promise.all([
    loadTableMeta(URL.ACT),
    loadTableMeta(URL.SUB),
    loadTableMeta(URL.TAR),
    loadTableMeta(URL.AVT),
    loadTableMeta(URL.UB),
    loadTableMeta(URL.NAR)
  ]);

  actividadInfo = {
    codeField: pickFieldName(mAct.fields, ["CodigoActividad","Codigo","CODIGO","COD_ACTIVIDAD"]),
    nameField: pickFieldName(mAct.fields, ["Nombre","NombreActividad","Descripcion","Titulo"]),
    globalIdField: pickFieldName(mAct.fields, ["GlobalID","GLOBALID"]),
    activoField: pickFieldName(mAct.fields, ["Activo","Estado","Habilitado"]),
    vigField: pickFieldName(mAct.fields, ["Vigencia","ANIO","Ano"])
  };

  subactInfo = {
    codeField: pickFieldName(mSub.fields, ["CodigoSubActividad","Codigo","CODIGO"]),
    nameField: pickFieldName(mSub.fields, ["Nombre","NombreSubActividad","Descripcion","Titulo"]),
    globalIdField: pickFieldName(mSub.fields, ["GlobalID","GLOBALID"]),
    fkActividad: pickFieldName(mSub.fields, ["ActividadGlobalID","ActividadGUID","ActividadID","FK_Actividad"])
  };

  tareaInfo = {
    codeField: pickFieldName(mTar.fields, ["CodigoTarea","Codigo","CODIGO"]),
    nameField: pickFieldName(mTar.fields, ["Nombre","NombreTarea","Descripcion","Titulo"]),
    globalIdField: pickFieldName(mTar.fields, ["GlobalID","GLOBALID"]),
    fkSub: pickFieldName(mTar.fields, ["SubActividadGlobalID","SubActividadGUID","SubActividadID","FK_SubActividad"]),
    flagGeo: pickFieldName(mTar.fields, ["EsGeorreferenciable","EsMunicipalizable","Municipalizable","RequiereUbicacion","RequiereMunicipalizacion"])
  };

  avanceInfo = {
    linkField: pickFieldName(mAvt.fields, ["AvanceTareaID","RegistroID","GUID","UUID"]),
    fkTarea: pickFieldName(mAvt.fields, ["TareaGlobalID","TareaGUID","TareaID","FK_Tarea"]),
    fkSub: pickFieldName(mAvt.fields, ["SubActividadGlobalID","SubActividadGUID","FK_SubActividad"]),
    fkAct: pickFieldName(mAvt.fields, ["ActividadGlobalID","ActividadGUID","FK_Actividad"]),
    vigField: pickFieldName(mAvt.fields, ["Vigencia","ANIO","Ano"]),
    perField: pickFieldName(mAvt.fields, ["Periodo","Trimestre","PERIODO"]),
    valField: pickFieldName(mAvt.fields, ["ValorReportado","ValorEjecutado","Avance","Valor"]),
    obsField: pickFieldName(mAvt.fields, ["Observaciones","Observacion","Notas","Comentario"]),
    eviField: pickFieldName(mAvt.fields, ["EvidenciaURL","Evidencia","URLSoporte","SoporteURL"]),
    fecField: pickFieldName(mAvt.fields, ["FechaRegistro","Fecha","CreatedDate"]),
    munField: pickFieldName(mAvt.fields, ["Municipio","CodigoMunicipio","Mun"])
  };

  ubicInfo = {
    linkField: pickFieldName(mUb.fields, ["AvanceTareaID","RegistroID","GUID","UUID","AvanceTareaGlobalID"]),
    munField: pickFieldName(mUb.fields, ["Municipio","CodigoMunicipio","Mun"]),
    descField: pickFieldName(mUb.fields, ["DescripcionSitio","Descripcion","Sitio","Observaciones","Notas"]),
    lonField: pickFieldName(mUb.fields, ["Longitud","Lon","X"]),
    latField: pickFieldName(mUb.fields, ["Latitud","Lat","Y"])
  };

  narrativaInfo = {
    linkField: pickFieldName(mNar.fields, ["NarrativaID","RegistroID","GUID","UUID"]),
    fkAct: pickFieldName(mNar.fields, ["ActividadGlobalID","ActividadGUID","ActividadID","FK_Actividad"]),
    vigField: pickFieldName(mNar.fields, ["Vigencia","ANIO","Ano"]),
    perField: pickFieldName(mNar.fields, ["Periodo","Trimestre","PERIODO"]),
    txtField: pickFieldName(mNar.fields, ["TextoNarrativo","Narrativa","Texto","Descripcion"]),
    fecField: pickFieldName(mNar.fields, ["FechaRegistro","Fecha","CreatedDate"])
  };
}

// ---------- Municipios ----------
async function loadMunicipiosDomain(){
  const svc = await fetchJson(SERVICE_URL, { f:"json" });
  if(Array.isArray(svc?.domains)){
    for(const d of svc.domains){
      if(d?.name === "DM_Municipio" && d?.codedValues){
        municipiosDomain = parseDomainValues(d);
        return;
      }
    }
  }
  // fallback desde tabla ubic
  const mUb = await fetchJson(URL.UB, { f:"json" });
  const mf = (mUb?.fields || []).find(f => f?.name === "Municipio" || f?.name === "CodigoMunicipio");
  if(mf?.domain?.codedValues){
    municipiosDomain = parseDomainValues(mf.domain);
    return;
  }
  municipiosDomain = null;
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

// ---------- Load actividades ----------
async function loadActividades(){
  setStatus("Cargando actividades…");
  elActividad.innerHTML = `<option value="">Cargando…</option>`;

  const vig = Number(elVigencia.value) || new Date().getFullYear();

  let where = "1=1";
  if(actividadInfo.activoField) where += " AND (Activo = 'SI' OR Activo = 1 OR Activo = 'S' OR Activo = '1')";
  if(actividadInfo.vigField) where += ` AND ${actividadInfo.vigField} = ${vig}`;

  const q = await fetchJson(`${URL.ACT}/query`, {
    f:"json",
    where,
    outFields: "*",
    orderByFields: (actividadInfo.nameField || actividadInfo.codeField || "OBJECTID") + " ASC",
    returnGeometry: "false"
  });

  const feats = q?.features || [];
  if(!feats.length){
    elActividad.innerHTML = `<option value="">No hay actividades para la vigencia ${vig}</option>`;
    setStatus("No se encontraron actividades.", "error");
    return;
  }

  elActividad.innerHTML = `<option value="">— Selecciona una actividad —</option>` + feats.map(f => {
    const a = f.attributes || {};
    const gid = getAttr(a,[actividadInfo.globalIdField,"GlobalID","GLOBALID","OBJECTID"]);
    const code = getAttr(a,[actividadInfo.codeField,"CodigoActividad","Codigo","CODIGO"]) ?? "";
    const name = getAttr(a,[actividadInfo.nameField,"Nombre","NombreActividad","Descripcion","Titulo"]) ?? "";
    const label = (code && name) ? `${code} — ${name}` : (name || code || String(gid));
    return `<option value="${escapeHtml(String(gid))}">${escapeHtml(label)}</option>`;
  }).join("");

  setStatus("Actividades cargadas.", "success");
}

// ---------- Load tree ----------
async function loadTreeForActividad(actividadGid){
  elSubacts.innerHTML = "";
  subactsCache = [];
  tareasCache = [];
  tareasBySub.clear();
  rowGeometries.clear();
  activeRowId = null;
  pillActive.textContent = "Registro activo: —";
  clearMapGraphics();

  if(!actividadGid) return;

  setStatus("Cargando subactividades y tareas…");

  let whereSub = "1=1";
  if(subactInfo.fkActividad){
    const val1 = actividadGid;
    const val2 = actividadGid.startsWith("{") ? actividadGid : `{${actividadGid.replaceAll(/[{}]/g,'')}}`;
    whereSub = `(${subactInfo.fkActividad} = '${val1}' OR ${subactInfo.fkActividad} = '${val2}')`;
  }

  const qSub = await fetchJson(`${URL.SUB}/query`, {
    f:"json",
    where: whereSub,
    outFields: "*",
    orderByFields: (subactInfo.codeField || subactInfo.nameField || "OBJECTID") + " ASC",
    returnGeometry: "false"
  });
  subactsCache = (qSub?.features || []).map(f => f.attributes);

  if(!subactsCache.length){
    elSubacts.innerHTML = `<div class="card"><div class="muted">No hay subactividades asociadas.</div></div>`;
    setStatus("No se encontraron subactividades.", "error");
    return;
  }

  const subGids = subactsCache.map(a => getAttr(a,[subactInfo.globalIdField,"GlobalID","GLOBALID"])).filter(Boolean);
  if(!subGids.length){
    setStatus("No se pudo leer GlobalID de subactividades.", "error");
    return;
  }

  let whereTar = "1=2";
  if(tareaInfo.fkSub){
    const parts = subGids.map(g => `'${String(g).replaceAll("'","''")}'`);
    whereTar = `${tareaInfo.fkSub} IN (${parts.join(",")})`;
  }

  const qTar = await fetchJson(`${URL.TAR}/query`, {
    f:"json",
    where: whereTar,
    outFields: "*",
    orderByFields: (tareaInfo.codeField || tareaInfo.nameField || "OBJECTID") + " ASC",
    returnGeometry: "false"
  });
  tareasCache = (qTar?.features || []).map(f => f.attributes);

  tareasCache.forEach(t => {
    const sid = getAttr(t, [tareaInfo.fkSub]);
    if(!sid) return;
    const k = String(sid);
    if(!tareasBySub.has(k)) tareasBySub.set(k, []);
    tareasBySub.get(k).push(t);
  });

  elSubacts.innerHTML = subactsCache.map(sa => subactividadCardHtml(sa)).join("");
  wireTaskEvents();

  setStatus("Listo. Reporta avances por tarea.", "success");
}

function subactividadCardHtml(sa){
  const subGid = getAttr(sa,[subactInfo.globalIdField,"GlobalID","GLOBALID"]);
  const code = getAttr(sa,[subactInfo.codeField,"Codigo","CODIGO"]) ?? "—";
  const name = getAttr(sa,[subactInfo.nameField,"Nombre","Descripcion","Titulo"]) ?? "—";
  const tareas = tareasBySub.get(String(subGid)) || [];
  const tareasHtml = tareas.length ? tareas.map(t => taskRowHtml(t, subGid)).join("") : `<div class="muted">No hay tareas asociadas.</div>`;

  return `
  <div class="card" data-sub-gid="${escapeHtml(String(subGid))}">
    <div class="subact__header">
      <div>
        <p class="subact__title">${escapeHtml(code)} — ${escapeHtml(name)}</p>
        <div class="subact__meta">
          <span class="task__pill">Subactividad</span>
          <span class="task__pill mono">${escapeHtml(String(subGid))}</span>
          <span class="task__pill">Tareas: <b>${tareas.length}</b></span>
        </div>
      </div>
    </div>
    <div class="rows">
      ${tareasHtml}
    </div>
  </div>`;
}

function taskRowHtml(t, subGid){
  const rowId = crypto.randomUUID();
  const tarGid = getAttr(t,[tareaInfo.globalIdField,"GlobalID","GLOBALID"]);
  const code = getAttr(t,[tareaInfo.codeField,"Codigo","CODIGO"]) ?? "—";
  const name = getAttr(t,[tareaInfo.nameField,"Nombre","Descripcion","Titulo"]) ?? "—";
  const isGeo = normYes(getAttr(t,[tareaInfo.flagGeo]));

  return `
  <div class="row" data-row-id="${rowId}" data-sub-gid="${escapeHtml(String(subGid))}" data-tar-gid="${escapeHtml(String(tarGid))}" data-geo="${isGeo ? "1":"0"}">
    <div class="row__left">
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Tarea</label>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <span class="task__pill"><b>${escapeHtml(code)}</b></span>
          <span>${escapeHtml(name)}</span>
          ${isGeo ? `<span class="badge">Municipalizable</span>` : `<span class="badge">No municipalizable</span>`}
        </div>
      </div>

      <div class="field" style="padding:0;">
        <label>Valor reportado</label>
        <input class="row-valor" type="number" step="any" placeholder="Ej: 12" />
      </div>

      <div class="field" style="padding:0;">
        <label>Evidencia (URL)</label>
        <input class="row-evi" type="url" placeholder="https://…" />
      </div>

      <div class="field task__grid--full" style="padding:0;">
        <label>Observaciones</label>
        <input class="row-obs" type="text" placeholder="Descripción corta del avance…" />
      </div>

      <div class="field" style="padding:0; display:${isGeo ? "block":"none"};">
        <label>Municipio</label>
        <select class="row-municipio">${municipioOptionsHtml()}</select>
      </div>

      <div class="field" style="padding:0; display:${isGeo ? "block":"none"};">
        <label>Descripción del sitio</label>
        <input class="row-sitio" type="text" placeholder="Ej: obra, sede, punto de intervención…" />
      </div>
    </div>

    <div class="row__right">
      <button class="btn btn--primary btn-ubicar" ${isGeo ? "" : "disabled"}>Ubicar punto</button>
      <button class="btn btn--ghost btn-ver" ${isGeo ? "" : "disabled"}>Ver punto</button>
      <button class="btn btn--danger btn-quitar" ${isGeo ? "" : "disabled"}>Quitar punto</button>
      <div class="row__mini"><span>Punto: <b class="row-pt">—</b></span></div>
    </div>
  </div>`;
}

function wireTaskEvents(){
  document.querySelectorAll(".row").forEach(rowEl => {
    const rowId = rowEl.getAttribute("data-row-id");
    const isGeo = rowEl.getAttribute("data-geo") === "1";
    const btnUb = rowEl.querySelector(".btn-ubicar");
    const btnVer = rowEl.querySelector(".btn-ver");
    const btnQt = rowEl.querySelector(".btn-quitar");
    const selMun = rowEl.querySelector(".row-municipio");

    if(btnUb){
      btnUb.addEventListener("click", () => {
        if(!isGeo) return;
        const mun = selMun?.value;
        if(!mun){
          setStatus("Selecciona municipio antes de ubicar el punto.", "error");
          return;
        }
        activeRowId = rowId;
        pillActive.textContent = `Registro activo: ${rowId.slice(0,8)}…`;
        setStatus("Ahora haz clic en el mapa para ubicar el punto.", "info");
      });
    }

    if(btnVer){
      btnVer.addEventListener("click", () => {
        const pt = rowGeometries.get(rowId);
        if(!pt){ setStatus("Este registro aún no tiene punto.", "error"); return; }
        zoomToPoint(pt.lon, pt.lat);
      });
    }

    if(btnQt){
      btnQt.addEventListener("click", () => {
        rowGeometries.delete(rowId);
        removeGraphicForRow(rowId);
        rowEl.querySelector(".row-pt").textContent = "—";
        if(activeRowId === rowId){
          activeRowId = null;
          pillActive.textContent = "Registro activo: —";
        }
      });
    }
  });
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
          setStatus("Activa una tarea municipalizable con “Ubicar punto”.", "error");
          return;
        }
        const rowEl = document.querySelector(`.row[data-row-id="${activeRowId}"]`);
        const isGeo = rowEl?.getAttribute("data-geo") === "1";
        if(!isGeo){
          setStatus("La tarea activa no requiere municipalización.", "error");
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

        if(rowEl){
          rowEl.querySelector(".row-pt").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
        setStatus("Punto asignado.", "success");
      });

      btnLimpiarMapa.addEventListener("click", () => {
        rowGeometries.clear();
        clearMapGraphics();
        document.querySelectorAll(".row .row-pt").forEach(x => x.textContent = "—");
      });

      btnCentrar.addEventListener("click", () => {
        view.goTo({ center: [-74.2, 4.7], zoom: 8 });
      });

      resolve();
    }, reject);
  });
}

function clearMapGraphics(){ if(graphicsLayer) graphicsLayer.removeAll(); }

function upsertGraphicForRow(rowId, lon, lat){
  require(["esri/Graphic"], (Graphic) => {
    removeGraphicForRow(rowId);
    graphicsLayer.add(new Graphic({
      geometry: { type:"point", longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } },
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: [23,151,209,0.9],
        size: 10,
        outline: { color: [11,82,105,1], width: 2 }
      },
      attributes: { rowId }
    }));
  });
}

function removeGraphicForRow(rowId){
  if(!graphicsLayer) return;
  const toRemove = graphicsLayer.graphics.filter(g => g?.attributes?.rowId === rowId);
  toRemove.forEach(g => graphicsLayer.remove(g));
}

function zoomToPoint(lon, lat){ if(view) view.goTo({ center:[lon,lat], zoom:14 }); }

// ---------- Save ----------
function collectDraft(){
  const actividadGid = elActividad.value;
  const vig = Number(elVigencia.value) || new Date().getFullYear();
  const periodo = elPeriodo.value;
  if(!actividadGid) throw new Error("Selecciona una actividad.");

  const avancesAdds = [];
  const ubicAdds = [];

  document.querySelectorAll(".row").forEach(rowEl => {
    const isGeo = rowEl.getAttribute("data-geo") === "1";
    const tarGid = rowEl.getAttribute("data-tar-gid");
    const subGid = rowEl.getAttribute("data-sub-gid");
    const rowId = rowEl.getAttribute("data-row-id");

    const valor = rowEl.querySelector(".row-valor").value;
    const obs = rowEl.querySelector(".row-obs").value;
    const evi = rowEl.querySelector(".row-evi").value;

    const mun = rowEl.querySelector(".row-municipio")?.value;
    const sitio = rowEl.querySelector(".row-sitio")?.value;

    const pt = rowGeometries.get(rowId);

    const hasAny = (valor !== "") || (obs && obs.trim()) || (evi && evi.trim()) || mun || (sitio && sitio.trim()) || pt;
    if(!hasAny) return;

    if(valor === "") throw new Error("Hay una tarea con datos pero sin Valor reportado.");
    if(isGeo){
      if(!mun) throw new Error("Hay una tarea municipalizable sin Municipio.");
      if(!pt) throw new Error("Hay una tarea municipalizable sin Punto.");
    }

    const linkId = guidBraced();

    const a = {};
    if(avanceInfo.linkField) a[avanceInfo.linkField] = linkId;
    if(avanceInfo.fkTarea) a[avanceInfo.fkTarea] = tarGid;
    if(avanceInfo.fkSub) a[avanceInfo.fkSub] = subGid;
    if(avanceInfo.fkAct) a[avanceInfo.fkAct] = actividadGid;
    if(avanceInfo.vigField) a[avanceInfo.vigField] = vig;
    if(avanceInfo.perField) a[avanceInfo.perField] = periodo;
    if(avanceInfo.valField) a[avanceInfo.valField] = Number(valor);
    if(avanceInfo.obsField) a[avanceInfo.obsField] = obs || null;
    if(avanceInfo.eviField) a[avanceInfo.eviField] = evi || null;
    if(avanceInfo.fecField) a[avanceInfo.fecField] = Date.now();
    if(avanceInfo.munField && mun) a[avanceInfo.munField] = mun;

    avancesAdds.push({ attributes: a });

    if(isGeo){
      const u = {};
      if(ubicInfo.linkField) u[ubicInfo.linkField] = (ubicInfo.linkField === "AvanceTareaGlobalID") ? null : linkId;
      if(ubicInfo.munField) u[ubicInfo.munField] = mun;
      if(ubicInfo.descField) u[ubicInfo.descField] = sitio || null;
      if(ubicInfo.lonField) u[ubicInfo.lonField] = pt.lon;
      if(ubicInfo.latField) u[ubicInfo.latField] = pt.lat;

      ubicAdds.push({
        attributes: u,
        geometry: { x: pt.lon, y: pt.lat, spatialReference: { wkid: 4326 } }
      });
    }
  });

  if(!avancesAdds.length) throw new Error("No hay avances para guardar.");

  const narrativaTxt = elNarrativa.value?.trim() || "";
  const narrativaAdd = narrativaTxt ? { attributes: (() => {
    const n = {};
    if(narrativaInfo.linkField) n[narrativaInfo.linkField] = guidBraced();
    if(narrativaInfo.fkAct) n[narrativaInfo.fkAct] = actividadGid;
    if(narrativaInfo.vigField) n[narrativaInfo.vigField] = vig;
    if(narrativaInfo.perField) n[narrativaInfo.perField] = periodo;
    if(narrativaInfo.txtField) n[narrativaInfo.txtField] = narrativaTxt;
    if(narrativaInfo.fecField) n[narrativaInfo.fecField] = Date.now();
    return n;
  })()} : null;

  return { avancesAdds, ubicAdds, narrativaAdd };
}

async function saveDraft(draft){
  setStatus(`Guardando ${draft.avancesAdds.length} avance(s)…`);
  const resAv = await postForm(`${URL.AVT}/applyEdits`, { f:"json", adds: draft.avancesAdds });
  if(resAv?.error) throw new Error(resAv.error.message || "Error al guardar avances.");
  const addResults = resAv?.addResults || [];
  if(addResults.some(r => !r.success)) throw new Error("Uno o más avances no se guardaron.");

  if(draft.ubicAdds.length){
    if(ubicInfo.linkField === "AvanceTareaGlobalID"){
      for(let i=0;i<draft.ubicAdds.length;i++){
        const gid = addResults[i]?.globalId;
        if(gid) draft.ubicAdds[i].attributes[ubicInfo.linkField] = gid;
      }
    }
    setStatus(`Guardando ${draft.ubicAdds.length} ubicación(es)…`);
    const resUb = await postForm(`${URL.UB}/applyEdits`, { f:"json", adds: draft.ubicAdds });
    if(resUb?.error) throw new Error(resUb.error.message || "Error al guardar ubicaciones.");
    if((resUb?.addResults || []).some(r => !r.success)) throw new Error("Una o más ubicaciones no se guardaron.");
  }

  if(draft.narrativaAdd){
    setStatus("Guardando reporte narrativo…");
    const resNar = await postForm(`${URL.NAR}/applyEdits`, { f:"json", adds: [draft.narrativaAdd] });
    if(resNar?.error) throw new Error(resNar.error.message || "Error al guardar narrativa.");
    if((resNar?.addResults || []).some(r => !r.success)) throw new Error("La narrativa no se guardó.");
  }
}

// ---------- UI wiring ----------
btnGuardar.addEventListener("click", async () => {
  try{
    btnGuardar.disabled = true;
    const draft = collectDraft();
    await saveDraft(draft);
    setStatus("Reporte guardado correctamente.", "success");
    await loadTreeForActividad(elActividad.value);
    elNarrativa.value = "";
    rowGeometries.clear();
    clearMapGraphics();
    activeRowId = null;
    pillActive.textContent = "Registro activo: —";
  }catch(e){
    console.error(e);
    setStatus(e.message || "Error inesperado.", "error");
  }finally{
    btnGuardar.disabled = false;
  }
});

btnLimpiar.addEventListener("click", () => {
  elNarrativa.value = "";
  rowGeometries.clear();
  clearMapGraphics();
  activeRowId = null;
  pillActive.textContent = "Registro activo: —";
  document.querySelectorAll(".row-valor").forEach(i => i.value = "");
  document.querySelectorAll(".row-obs").forEach(i => i.value = "");
  document.querySelectorAll(".row-evi").forEach(i => i.value = "");
  document.querySelectorAll(".row-municipio").forEach(i => i.value = "");
  document.querySelectorAll(".row-sitio").forEach(i => i.value = "");
  document.querySelectorAll(".row-pt").forEach(x => x.textContent = "—");
  setStatus("Formulario limpiado.", "info");
});

btnRefresh.addEventListener("click", async () => {
  try{
    municipiosDomain = null;
    tableInfo.clear();
    await bootstrap(true);
  }catch(e){
    console.error(e);
    setStatus("No fue posible recargar catálogos.", "error");
  }
});

elActividad.addEventListener("change", async () => {
  await loadTreeForActividad(elActividad.value);
});

elVigencia.addEventListener("change", async () => {
  await loadActividades();
  await loadTreeForActividad(elActividad.value);
});

// ---------- Bootstrap ----------
async function bootstrap(forceReload=false){
  setStatus("Inicializando…");
  await bootstrapMeta();
  await loadMunicipiosDomain();
  await loadActividades();
  setStatus("Listo.", "success");
}

(async function main(){
  try{
    await initMap();
    await bootstrap(false);
  }catch(e){
    console.error(e);
    setStatus("No se pudo inicializar la app. Revisa consola.", "error");
  }
})();
