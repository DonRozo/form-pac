/* ===========================================================
   DATA-PAC | Reporte y Corrección (v3)
   Esquema: DATAPAC_V3
   Mejoras: OTP con Roles, Filtro Asignación x Vigencia, 
            Estandarización de Estados, Modo Histórico Seguro, 
            Trazabilidad, Bloqueo CAR, Limpieza UI de Geocodes.
   =========================================================== */

const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V3/FeatureServer";
const CAR_SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/MpiosCAR/FeatureServer";
const CAR_JUR_LAYER_ID = 0; 

// URL PowerAutomate OTP
const URL_WEBHOOK_POWERAUTOMATE = "https://default64f30d63182749d899511db17d0949.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/1123b3fd4a854b40b2b22dd45b03ca7c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Qz68D2G5RAq9cmMvOew1roy8bD3YQPtju4KPW2vEtvc"; 

// Índices V3
const URL_ACTIVIDAD = `${SERVICE_URL}/6`;
const URL_SUBACTIVIDAD = `${SERVICE_URL}/7`;
const URL_TAREA = `${SERVICE_URL}/8`;
const URL_AVANCE_TAREA = `${SERVICE_URL}/9`;
const URL_TAREA_UBICACION = `${SERVICE_URL}/10`; 
const URL_NARRATIVA = `${SERVICE_URL}/11`;
const URL_ASIGNACION = `${SERVICE_URL}/15`; 
const URL_PERSONA = `${SERVICE_URL}/16`; 
const URL_OTP = `${SERVICE_URL}/17`;
const URL_ROL = `${SERVICE_URL}/21`; // SEG_PersonaRol
const URL_AUD_HISTORIAL = `${SERVICE_URL}/23`; // AUD_HistorialCambio
const URL_AUD_EVENTO = `${SERVICE_URL}/24`; // AUD_EventoSistema
const URL_WF_SOLICITUD = `${SERVICE_URL}/25`;

const F_AVA = { fkTarea: "TareaGlobalID", vig: "Vigencia", per: "Periodo", val: "ValorReportado", obs: "Observaciones", evi: "EvidenciaURL", fec: "FechaRegistro", resp: "Responsable", estado: "EstadoRegistro", ver: "Version", fEdic: "FechaUltimaEdicionFuncional", pEdic: "PersonaUltimaEdicionID", motivo: "MotivoAjuste" };
const F_NAR = { fkAct: "ActividadGlobalID", vig: "Vigencia", per: "Periodo", txt1: "TextoNarrativo", txt2: "DescripcionLogrosAlcanzados", txt3: "PrincipalesLogros", fec: "FechaRegistro", resp: "Responsable", estado: "EstadoRegistro", ver: "Version", fEdic: "FechaUltimaEdicionFuncional", pEdic: "PersonaUltimaEdicionID", motivo: "MotivoAjuste" };
const F_UBI = { fkAvance: "AvanceTareaGlobalID", dane: "CodigoDANE", mun: "MunicipioNombre", desc: "DescripcionSitio", fec: "FechaRegistro" };
const F_WF = { solId: "SolicitudID", tipo: "TipoObjeto", objId: "ObjetoID", objGid: "ObjetoGlobalID", vig: "Vigencia", per: "Periodo", persId: "PersonaSolicitaID", fec: "FechaSolicitud", est: "EstadoActual" };

// DOM
const elActividad = document.getElementById("sel-actividad"), elVigencia = document.getElementById("sel-vigencia"), elPeriodo = document.getElementById("sel-periodo"), elIndicadores = document.getElementById("indicadores");
const btnGuardar = document.getElementById("btn-guardar"), btnEnviar = document.getElementById("btn-enviar"), btnLimpiar = document.getElementById("btn-limpiar"), btnRefresh = document.getElementById("btn-refresh");
const elStatus = document.getElementById("status"), pillActive = document.getElementById("pill-active");
const elModo = document.getElementById("pill-modo");

// Estado
let currentUser = null; 
let asignacionesActivas = []; 
let cacheSubactividades = [], cacheTareas = [];
let existingAvances = new Map(); 
let existingNarrativa = null; 
let existingWFSolicitudes = new Map(); 
let deletedLocations = []; 
let rowLocations = new Map(); 
let activeRowId = null;
let viewOnlyMode = false; // Bandera para Histórico
let map, view, graphicsLayer, webMercatorUtils, sketchVM, jurisdiccionLayerView;

// --- Helpers ---
function setStatus(msg, type="info"){ elStatus.textContent = (type==="error"?"❌ ":(type==="success"?"✅ ":"ℹ️ ")) + msg; }
function escapeHtml(s){ return (s??"").toString().replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function toYesNo(v){ const s=(v||"").toString().toLowerCase(); return (s==="si"||s==="sí"||s==="true")?true:(s==="no"||s==="false"?false:null); }
async function fetchJson(url, params){ const u=new URL(url); Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v)); const r=await fetch(u, {method:"GET"}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
async function postForm(url, formObj){ const form=new URLSearchParams(); Object.entries(formObj).forEach(([k,v])=>{ if(v!=null) form.append(k,typeof v==="string"?v:JSON.stringify(v)); }); const r=await fetch(url, {method:"POST", body:form}); return await r.json(); }
function generateGUID() { return '{' + crypto.randomUUID().toUpperCase() + '}'; }

// --- Estandarización de Estados ---
function normalizeState(st) {
    if (!st) return "Borrador";
    const s = String(st).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (s.includes("devuelto")) return "Devuelto";
    if (s.includes("enviado")) return "Enviado";
    if (s.includes("enrevision") || s.includes("revision")) return "EnRevision";
    if (s.includes("aprobado")) return "Aprobado";
    if (s.includes("publicado")) return "Publicado";
    return "Borrador";
}

// --- Funciones de Auditoría ---
async function writeAuditEvent(tipo, entidad, objGid, resultado, detalle) {
  if (!currentUser) return;
  try {
    const attrs = { GlobalID: generateGUID(), TipoEvento: tipo, Entidad: entidad, ObjetoGlobalID: objGid || "", Resultado: resultado, DetalleEvento: detalle ? detalle.substring(0, 255) : "", PersonaID: currentUser.pid, FechaEvento: Date.now() };
    await postForm(`${URL_AUD_EVENTO}/applyEdits`, { adds: [{attributes: attrs}] });
  } catch(e) { console.warn("Auditoría Evento falló (silenciado):", e); }
}

async function writeAuditHistory(tipoObj, objGid, campo, valAnt, valNuevo, motivo) {
  if (!currentUser) return;
  try {
    const attrs = { GlobalID: generateGUID(), TipoObjeto: tipoObj, ObjetoID: "0", ObjetoGlobalID: objGid || "", CampoModificado: campo || "", ValorAnterior: valAnt ? String(valAnt).substring(0, 1000) : "", ValorNuevo: valNuevo ? String(valNuevo).substring(0, 1000) : "", PersonaID: currentUser.pid, FechaCambio: Date.now(), MotivoCambio: motivo || "", OrigenCambio: "APP_REPORTE" };
    await postForm(`${URL_AUD_HISTORIAL}/applyEdits`, { adds: [{attributes: attrs}] });
  } catch(e) { console.warn("Auditoría Historial falló (silenciado):", e); }
}

// --- Autenticación OTP y Roles ---
document.getElementById("btn-solicitar-codigo").addEventListener("click", async () => {
  const cedula = document.getElementById("login-cedula").value.trim(), correo = document.getElementById("login-correo").value.trim().toLowerCase();
  document.getElementById("login-msg-1").textContent = "";
  try {
    const res = await fetch(URL_WEBHOOK_POWERAUTOMATE, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({cedula, correo}) });
    if(res.status === 200) { document.getElementById("login-step-1").classList.remove("active"); document.getElementById("login-step-2").classList.add("active"); }
    else throw new Error("Credenciales inválidas o error de conexión.");
  } catch(e) { document.getElementById("login-msg-1").textContent = e.message; }
});

document.getElementById("btn-validar-codigo").addEventListener("click", async () => {
  const correo = document.getElementById("login-correo").value.trim().toLowerCase(), codigo = document.getElementById("login-codigo").value.trim();
  document.getElementById("login-msg-2").textContent = "Validando acceso...";
  try {
    const qOtp = await fetchJson(`${URL_OTP}/query`, { f:"json", where:`Correo='${correo}' AND CodigoHash='${codigo}' AND Usado='NO'`, outFields:"*" });
    if(!qOtp.features.length) throw new Error("Código incorrecto.");
    const otp = qOtp.features[0].attributes;
    
    // Validación estricta de persona activa
    const qPers = await fetchJson(`${URL_PERSONA}/query`, { f:"json", where:`GlobalID='${otp.PersonaGlobalID}' AND Activo='SI'`, outFields:"Nombre,PersonaID" });
    if(!qPers.features.length) throw new Error("Usuario inactivo o no encontrado en el sistema.");
    const pid = qPers.features[0].attributes.PersonaID;

    // Validación de Roles (Debe ser EDITOR o SUPERADMIN)
    const resR = await fetchJson(`${URL_ROL}/query`, { f: "json", where: `(PersonaID='${otp.PersonaGlobalID}' OR PersonaID='${pid}') AND Activo='SI'`, outFields: "RolID", returnGeometry: false });
    const roles = (resR.features || []).map(f => String(f.attributes.RolID).trim().toUpperCase());
    
    if (!roles.includes("EDITOR") && !roles.includes("SUPERADMIN")) {
        throw new Error("Acceso denegado: Su rol no le permite utilizar esta aplicación de captura operativa.");
    }

    currentUser = { gid: otp.PersonaGlobalID, pid: pid, nombre: qPers.features[0].attributes.Nombre, correo, roles };
    
    await postForm(`${URL_OTP}/applyEdits`, { f:"json", updates: [{attributes: {OBJECTID: otp.OBJECTID, Usado: "SI"}}] });
    await writeAuditEvent("OTP_VALIDATE", "APP_REPORTE", currentUser.gid, "OK", "Ingreso exitoso a módulo operativo");
    
    document.getElementById("login-overlay").style.display = "none";
    document.getElementById("pill-user").style.display = "block";
    document.getElementById("pill-user").textContent = `Usuario: ${currentUser.nombre}`;
    
    await initMap(); await loadAsignaciones(); await loadActividades();
  } catch(e) { document.getElementById("login-msg-2").textContent = e.message; }
});

// --- Filtros SEG_Asignacion V3 ---
async function loadAsignaciones() {
  if(!currentUser) return;
  const vig = elVigencia.value;
  // Cruce de alcance: la persona solo accede a las tareas asignadas en esta vigencia
  const qAsig = await fetchJson(`${URL_ASIGNACION}/query`, { f:"json", where:`PersonaGlobalID='${currentUser.gid}' AND Vigencia=${vig} AND Activo='SI'`, outFields:"ActividadID,TareaGlobalID" });
  asignacionesActivas = (qAsig.features || []).map(f => f.attributes);
}

async function loadActividades() {
  if(!currentUser) return;
  const actIds = [...new Set(asignacionesActivas.map(a => a.ActividadID).filter(Boolean))];
  if(!actIds.length) { 
      elActividad.innerHTML = `<option value="">Sin actividades asignadas en ${elVigencia.value}</option>`; 
      elIndicadores.innerHTML = "";
      return; 
  }
  
  const inList = actIds.map(id => `'${id}'`).join(",");
  const qAct = await fetchJson(`${URL_ACTIVIDAD}/query`, { f:"json", where:`ActividadID IN (${inList}) AND Activo='SI' AND Vigencia=${elVigencia.value}`, outFields:"GlobalID,ActividadID,NombreActividad", orderByFields:"ActividadID ASC" });
  
  elActividad.innerHTML = `<option value="">— Selecciona —</option>` + qAct.features.map(f => `<option value="${f.attributes.GlobalID}" data-codigo="${f.attributes.ActividadID}">${f.attributes.ActividadID} - ${f.attributes.NombreActividad}</option>`).join("");
}

elActividad.addEventListener("change", async () => {
  const actGid = elActividad.value, cod = elActividad.options[elActividad.selectedIndex]?.getAttribute("data-codigo");
  if(!actGid) { elIndicadores.innerHTML = ""; return; }
  document.getElementById("lbl-responsable").textContent = `Responsable: ${currentUser.nombre}`;
  await loadSubactividadesYTareas(actGid, cod);
});

elPeriodo.addEventListener("change", async () => {
  if(elActividad.value) await loadSubactividadesYTareas(elActividad.value, elActividad.options[elActividad.selectedIndex].getAttribute("data-codigo"));
});

async function loadSubactividadesYTareas(actividadGlobalId, actividadCod) {
  elIndicadores.innerHTML = ""; cacheSubactividades = []; cacheTareas = [];
  rowLocations.clear(); existingAvances.clear(); existingWFSolicitudes.clear(); deletedLocations = []; existingNarrativa = null;
  viewOnlyMode = false;
  setStatus("Cargando estructura y reportes existentes...");

  const subQ = await fetchJson(`${URL_SUBACTIVIDAD}/query`, { f:"json", where:`ActividadGlobalID='${actividadGlobalId}'`, outFields:"*" });
  cacheSubactividades = (subQ.features||[]).map(f=>f.attributes);
  
  const tareasAsignadas = asignacionesActivas.filter(a => a.ActividadID === actividadCod).map(a => a.TareaGlobalID).filter(Boolean);
  
  const inList = cacheSubactividades.map(s => `'${s.GlobalID}'`).join(",");
  if(inList) {
    const tareaQ = await fetchJson(`${URL_TAREA}/query`, { f:"json", where:`SubActividadGlobalID IN (${inList})`, outFields:"*" });
    let allTasks = (tareaQ.features||[]).map(f=>f.attributes);
    if(tareasAsignadas.length > 0) allTasks = allTasks.filter(t => tareasAsignadas.includes(t.GlobalID));
    cacheTareas = allTasks;
  }
  
  elIndicadores.innerHTML = cacheSubactividades.map(sa => subActividadCardHtml(sa)).join("");
  await loadExistingData(actividadGlobalId); 
  wireCardEvents();
  evaluateHistoricalMode();
  setStatus("Formulario cargado.", "success");
}

// --- Render y Estados ---
function tareaRowHtml(t){
  const rowId = crypto.randomUUID(), gid = t.GlobalID, cod = t.CodigoTarea, nom = t.NombreTarea, geo = toYesNo(t.EsGeorreferenciable);
  rowLocations.set(rowId, []);
  return `
  <div class="row" data-row-id="${rowId}" data-tarea-gid="${gid}" data-geo="${geo?"1":"0"}">
    <div class="row__left">
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <label>Tarea ${cod}</label>
        <div class="mono" style="font-size:12px; margin-bottom:6px;">${nom}</div>
        <div id="badge-container-${rowId}"></div>
      </div>
      <div class="field field-motivo" id="container-motivo-${rowId}" style="display:none; grid-column: 1 / span 2;">
        <label style="color:var(--danger);">Motivo de ajuste (Devuelto)</label>
        <input type="text" class="row-motivo" placeholder="Indica qué corregiste..." />
      </div>
      <div class="field" style="padding:0;"><label>Valor reportado</label><input class="row-valor" type="number" step="any" /></div>
      <div class="field" style="padding:0; grid-column: 1 / span 2;"><label>Observaciones</label><input class="row-obs" type="text" /></div>
      <div class="field" style="padding:0; grid-column: 1 / span 2;"><label>Evidencia (URL)</label><input class="row-obs row-evi" type="url" /></div>
      ${geo ? `<div class="loc-list" id="loc-list-${rowId}"></div>` : ``}
    </div>
    <div class="row__right">
      ${geo ? `<button class="btn btn--ghost btn-activar">Ubicar punto(s)</button>` : ``}
      <button class="btn btn--danger btn-eliminar" style="display:none;">Eliminar Fila (Local)</button>
    </div>
  </div>`;
}

function subActividadCardHtml(sa){
  const rows = cacheTareas.filter(t => t.SubActividadGlobalID === sa.GlobalID);
  if(!rows.length) return "";
  return `<div class="card"><div class="card__top"><p class="card__title">${sa.CodigoSubActividad} - ${sa.NombreSubActividad}</p></div><div class="rows">${rows.map(tareaRowHtml).join("")}</div></div>`;
}

// --- LECTURA BIDIRECCIONAL V3 ---
async function loadExistingData(actGid) {
  const vig = elVigencia.value, per = elPeriodo.value;
  const avGuids = [];

  // --- Limpieza preventiva para evitar duplicación visual de ubicaciones al recargar ---
  existingAvances.clear();
  existingWFSolicitudes.clear();
  existingNarrativa = null;
  deletedLocations = [];
  clearMapGraphics();
  document.querySelectorAll(".row").forEach(rowEl => {
      const rId = rowEl.getAttribute("data-row-id");
      rowLocations.set(rId, []);
      const locList = rowEl.querySelector(".loc-list");
      if (locList) locList.innerHTML = "";
  });
  // -----------------------------------------------------------------------------------
  
  // 1. Narrativa
  const qNar = await fetchJson(`${URL_NARRATIVA}/query`, { f:"json", where:`ActividadGlobalID='${actGid}' AND Vigencia=${vig} AND Periodo='${per}'`, outFields:"*" });
  if(qNar.features.length) {
    existingNarrativa = qNar.features[0].attributes;
    // Estandarizar estado desde la carga
    existingNarrativa.EstadoRegistro = normalizeState(existingNarrativa.EstadoRegistro);
    document.getElementById("txt-reporte-narrativo").value = existingNarrativa.TextoNarrativo || "";
    document.getElementById("txt-logros-descripcion").value = existingNarrativa.DescripcionLogrosAlcanzados || "";
    document.getElementById("txt-logros-principales").value = existingNarrativa.PrincipalesLogros || "";
    applyReadonlyStateNarrativa(existingNarrativa.EstadoRegistro);
  } else {
    ["txt-reporte-narrativo", "txt-logros-descripcion", "txt-logros-principales"].forEach(id => { document.getElementById(id).value = ""; document.getElementById(id).disabled = false; });
    document.getElementById("narrativa-badge-container").innerHTML = "";
    document.getElementById("container-motivo-narrativa").style.display = "none";
  }

  // 2. Avances
  const tGuids = cacheTareas.map(t=>`'${t.GlobalID}'`).join(",");
  if(tGuids) {
    const qAv = await fetchJson(`${URL_AVANCE_TAREA}/query`, { f:"json", where:`TareaGlobalID IN (${tGuids}) AND Vigencia=${vig} AND Periodo='${per}'`, outFields:"*" });
    qAv.features.forEach(f => {
      const a = f.attributes;
      a.EstadoRegistro = normalizeState(a.EstadoRegistro);
      existingAvances.set(a.TareaGlobalID, a);
      avGuids.push(`'${a.GlobalID}'`);
      const rowEl = document.querySelector(`.row[data-tarea-gid="${a.TareaGlobalID}"]`);
      if(rowEl) {
        rowEl.querySelector(".row-valor").value = a.ValorReportado ?? "";
        rowEl.querySelector(".row-obs").value = a.Observaciones || "";
        rowEl.querySelector(".row-evi").value = a.EvidenciaURL || "";
        applyReadonlyStateTask(rowEl, a.EstadoRegistro);
      }
    });
  }

  // 3. Ubicaciones
  if(avGuids.length) {
    const qUb = await fetchJson(`${URL_TAREA_UBICACION}/query`, { f:"json", where:`AvanceTareaGlobalID IN (${avGuids.join(",")})`, outFields:"*", returnGeometry:true, outSR:"4326" });
    qUb.features.forEach(f => {
      const u = f.attributes, geo = f.geometry;
      const tareaGid = [...existingAvances.entries()].find(([k,v]) => v.GlobalID === u.AvanceTareaGlobalID)?.[0];
      const rowEl = document.querySelector(`.row[data-tarea-gid="${tareaGid}"]`);
      if(rowEl) {
        const rowId = rowEl.getAttribute("data-row-id");
        const ptId = u.OBJECTID; 
        const locs = rowLocations.get(rowId) || [];
        locs.push({ ptId, isExisting: true, lon: geo.x, lat: geo.y, mun: u.MunicipioNombre, dane: u.CodigoDANE, desc: u.DescripcionSitio });
        rowLocations.set(rowId, locs);
        if(typeof esri !== 'undefined') { require(["esri/Graphic"], (Graphic) => { addGraphicForPoint(rowId, ptId, geo.x, geo.y, Graphic); }); }
        appendLocationUI(rowId, ptId, geo.x, geo.y, u.DescripcionSitio, u.MunicipioNombre, u.CodigoDANE);
      }
    });
  }

  // 4. Workflow (Evitar Duplicados)
  const allObjGuids = avGuids.concat(existingNarrativa ? [`'${existingNarrativa.GlobalID}'`] : []);
  if(allObjGuids.length > 0) {
    const qWf = await fetchJson(`${URL_WF_SOLICITUD}/query`, { 
      f:"json", where:`ObjetoGlobalID IN (${allObjGuids.join(",")}) AND Vigencia=${vig} AND Periodo='${per}'`, outFields:"OBJECTID,GlobalID,ObjetoGlobalID,Version" 
    });
    qWf.features.forEach(f => existingWFSolicitudes.set(f.attributes.ObjetoGlobalID, f.attributes));
  }
}

function applyReadonlyStateTask(rowEl, estado) {
  const isReadonly = ["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(estado);
  rowEl.querySelector(`[id^="badge-container-"]`).innerHTML = `<span class="status-badge status-badge--${estado.toLowerCase()}">${estado}</span>`;
  if(estado === "Devuelto") rowEl.querySelector(".field-motivo").style.display = "block";

  if(isReadonly) {
    rowEl.classList.add("is-readonly");
    rowEl.querySelectorAll("input").forEach(i => i.disabled = true);
    const btnAct = rowEl.querySelector(".btn-activar"); if(btnAct) btnAct.style.display = "none";
    rowEl.querySelectorAll(".btn-loc-del").forEach(b => b.style.display = "none");
  }
}

function applyReadonlyStateNarrativa(estado) {
  const isReadonly = ["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(estado);
  document.getElementById("narrativa-badge-container").innerHTML = `<span class="status-badge status-badge--${estado.toLowerCase()}">${estado}</span>`;
  if(estado === "Devuelto") document.getElementById("container-motivo-narrativa").style.display = "block";
  ["txt-reporte-narrativo", "txt-logros-descripcion", "txt-logros-principales", "txt-motivo-narrativa"].forEach(id => { document.getElementById(id).disabled = isReadonly; });
}

function evaluateHistoricalMode() {
    let allLocked = true;
    let hasData = false;

    // Verificar tareas
    document.querySelectorAll(".row").forEach(rowEl => {
        hasData = true;
        if (!rowEl.classList.contains("is-readonly")) {
            allLocked = false;
        }
    });

    // Verificar narrativa
    if (existingNarrativa) {
        hasData = true;
        if (!["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(existingNarrativa.EstadoRegistro)) {
            allLocked = false;
        }
    }

    // Modo Lectura Total (Histórico)
    if (hasData && allLocked) {
        viewOnlyMode = true;
        elModo.style.display = "flex";
        elModo.textContent = "Modo: Histórico (Solo Lectura)";
        elModo.style.background = "#fef2f2";
        elModo.style.color = "#991b1b";
        btnGuardar.style.display = "none";
        btnEnviar.style.display = "none";
        
        // Deshabilitar todos los inputs locales de ubicación si existieran residuales
        document.querySelectorAll(".loc-item input").forEach(i => i.disabled = true);
    } else {
        viewOnlyMode = false;
        elModo.style.display = "flex";
        elModo.textContent = "Modo: Edición";
        elModo.style.background = "#eff6ff";
        elModo.style.color = "#1d4ed8";
        btnGuardar.style.display = "inline-flex";
        btnEnviar.style.display = "inline-flex";
    }
}

function wireCardEvents() {
  document.querySelectorAll(".btn-activar").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const rowEl = e.target.closest(".row");
      if (rowEl.classList.contains("is-readonly") || viewOnlyMode) return;
      document.querySelectorAll(".row").forEach(r => r.style.borderColor = "rgba(15,23,42,0.20)");
      rowEl.style.borderColor = "var(--primary)";
      activeRowId = rowEl.getAttribute("data-row-id");
      const numTarea = rowEl.querySelector(".mono").textContent;
      document.getElementById("pill-active").textContent = `Activo: ${numTarea.substring(0, 30)}...`;
    });
  });
}

function deleteLocation(rowId, ptId) {
  if (viewOnlyMode) return;
  removeGraphicForPoint(ptId);
  const locs = rowLocations.get(rowId) || [];
  const locObj = locs.find(l => l.ptId === ptId);
  if(locObj && locObj.isExisting) deletedLocations.push(ptId); 
  rowLocations.set(rowId, locs.filter(l => l.ptId !== ptId));
  const el = document.getElementById(`loc-${ptId}`); if(el) el.remove();
}

function appendLocationUI(rowId, ptId, lon, lat, desc="", mun="", dane="") {
  const listEl = document.getElementById(`loc-list-${rowId}`); if(!listEl) return;
  const div = document.createElement("div"); div.className = "loc-item"; div.id = `loc-${ptId}`;
  const isError = mun === "Fuera de CAR" ? 'style="border: 1px solid red; background: #fff5f5;"' : '';
  div.innerHTML = `
    <div class="loc-item__header" ${isError}><span>📍 Sitio: <span class="loc-coords">${lat.toFixed(5)}, ${lon.toFixed(5)}</span></span><button class="btn-loc-del" ${viewOnlyMode?'style="display:none;"':''}>Eliminar</button></div>
    <div class="field" style="padding:0;"><input class="loc-desc" type="text" value="${escapeHtml(desc)}" placeholder="Descripción del sitio..." ${viewOnlyMode?'disabled':''} /></div>
    <div class="loc-item__grid">
      <div class="field" style="padding:0;"><input class="loc-mun" type="text" value="${escapeHtml(mun)}" readonly ${viewOnlyMode?'disabled':''} /></div>
      <div class="field" style="padding:0;"><input class="loc-dane" type="text" value="${escapeHtml(dane)}" readonly ${viewOnlyMode?'disabled':''} /></div>
    </div>`;
  div.querySelector(".btn-loc-del").addEventListener("click", () => deleteLocation(rowId, ptId));
  listEl.appendChild(div);
}

// --- MAPA ---
function initMap(){
  return new Promise((resolve, reject) => {
    require([ "esri/Map", "esri/views/MapView", "esri/layers/GraphicsLayer", "esri/layers/FeatureLayer", "esri/Graphic", "esri/widgets/Sketch/SketchViewModel", "esri/geometry/support/webMercatorUtils", "esri/widgets/Search", "esri/widgets/BasemapGallery", "esri/widgets/Expand"
    ], (Map, MapView, GraphicsLayer, FeatureLayer, Graphic, SketchViewModel, _webMercatorUtils, Search, BasemapGallery, Expand) => {
      webMercatorUtils = _webMercatorUtils; map = new Map({ basemap: "osm" });
      const jurisdiccionLayer = new FeatureLayer({ url: `${CAR_SERVICE_URL}/${CAR_JUR_LAYER_ID}`, title: "Municipios CAR", opacity: 0.15, outFields: ["*"] });
      map.add(jurisdiccionLayer); graphicsLayer = new GraphicsLayer({ title: "Puntos" }); map.add(graphicsLayer);
      view = new MapView({ container: "map", map, center: [-74.2, 4.7], zoom: 8, popup: { dockEnabled: true, dockOptions: { position: "top-right", breakpoint: false } } });
      view.ui.add(new Search({ view: view }), "top-right");
      view.ui.add(new Expand({ view: view, content: new BasemapGallery({ view: view, container: document.createElement("div") }), expandIcon: "basemap" }), "top-left");
      view.whenLayerView(jurisdiccionLayer).then((layerView) => { jurisdiccionLayerView = layerView; });
      sketchVM = new SketchViewModel({ view, layer: graphicsLayer, updateOnGraphicClick: false });

      sketchVM.on("update", async (evt) => {
        if(viewOnlyMode || evt.state !== "complete") return;
        const g = evt.graphics?.[0]; if(!g || !g.attributes?.rowId || !g.attributes?.ptId) return;
        const geo = getGeographicLocation(g.geometry); const rId = g.attributes.rowId; const pId = g.attributes.ptId;
        const locs = rowLocations.get(rId) || []; const locObj = locs.find(l => l.ptId === pId);
        if(locObj){ locObj.lon = geo.longitude; locObj.lat = geo.latitude; const el = document.getElementById(`loc-${pId}`); if(el) el.querySelector('.loc-coords').textContent = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`; }
        await updateMunicipioFromCAR(rId, pId, g.geometry);
      });

      view.on("click", async (evt) => {
        if(viewOnlyMode) return;
        if(!activeRowId){ setStatus("Activa un registro en el panel para georreferenciar.", "error"); return; }
        const geo = getGeographicLocation(evt.mapPoint); const ptId = crypto.randomUUID(); const locs = rowLocations.get(activeRowId) || [];
        locs.push({ ptId, lon: geo.longitude, lat: geo.latitude, mun: "", dane: "", desc: "" }); rowLocations.set(activeRowId, locs);
        addGraphicForPoint(activeRowId, ptId, geo.longitude, geo.latitude, Graphic);
        appendLocationUI(activeRowId, ptId, geo.longitude, geo.latitude);
        await updateMunicipioFromCAR(activeRowId, ptId, evt.mapPoint);
      });
      resolve(true);
    });
  });
}
function clearMapGraphics(){ if(graphicsLayer) graphicsLayer.removeAll(); }
function removeGraphicForPoint(ptId){ if(graphicsLayer) graphicsLayer.graphics.filter(g => g?.attributes?.ptId === ptId).forEach(g => graphicsLayer.remove(g)); }
function removeAllGraphicsForRow(rowId){ if(graphicsLayer) graphicsLayer.graphics.filter(g => g?.attributes?.rowId === rowId).forEach(g => graphicsLayer.remove(g)); }
function addGraphicForPoint(rowId, ptId, lon, lat, Graphic){ removeGraphicForPoint(ptId); const graphic = new Graphic({ geometry: { type: "point", longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } }, symbol: { type: "simple-marker", style: "circle", color: [23,151,209,0.9], size: 10, outline: { color: [11,82,105,1], width: 2 } }, attributes: { rowId, ptId } }); graphicsLayer.add(graphic); return graphic; }
function getGeographicLocation(p) { return (p.spatialReference && p.spatialReference.isWebMercator && webMercatorUtils) ? webMercatorUtils.webMercatorToGeographic(p) : p; }
async function updateMunicipioFromCAR(rowId, ptId, mapPoint){
  if (!jurisdiccionLayerView || viewOnlyMode) return;
  try{
    document.body.style.cursor = 'wait';
    const result = await jurisdiccionLayerView.queryFeatures({ geometry: mapPoint, spatialRelationship: "intersects", returnGeometry: false, outFields: ["*"] });
    const locEl = document.getElementById(`loc-${ptId}`); if(!locEl) return;
    const munEl = locEl.querySelector(".loc-mun"); const daneEl = locEl.querySelector(".loc-dane");
    
    if(!result.features.length){
      if(munEl) munEl.value = "Fuera de CAR"; if(daneEl) daneEl.value = "N/A";
      locEl.querySelector(".loc-item__header").style.border = "1px solid red";
      locEl.querySelector(".loc-item__header").style.background = "#fff5f5";
      view.popup.open({ title: "Atención: Fuera de jurisdicción", content: "Este punto no está dentro de la CAR. El sistema bloqueará el guardado si no lo corrige.", location: mapPoint });
      const locs = rowLocations.get(rowId) || []; const locObj = locs.find(l => l.ptId === ptId);
      if(locObj) { locObj.mun = "Fuera de CAR"; locObj.dane = "N/A"; }
      return;
    }
    locEl.querySelector(".loc-item__header").style.border = "none";
    locEl.querySelector(".loc-item__header").style.background = "transparent";

    const a = result.features[0].attributes; const keys = Object.keys(a);
    const mun = a[keys.find(k => k.toLowerCase().includes("municipio") || k.toLowerCase().includes("mpio"))] || "";
    const dane = String(a[keys.find(k => k.toLowerCase().includes("dane"))] || "");
    if(munEl) munEl.value = mun; if(daneEl) daneEl.value = dane;
    const locs = rowLocations.get(rowId) || []; const locObj = locs.find(l => l.ptId === ptId);
    if(locObj) { locObj.mun = mun; locObj.dane = dane; }
    view.popup.close();
  }catch(e){ console.error(e); }finally{ document.body.style.cursor = 'default'; }
}

// --- GUARDAR Y ENVIAR (V3) ---
btnGuardar.addEventListener("click", () => processSave(false));
btnEnviar.addEventListener("click", () => processSave(true));

async function processSave(isSubmit) {
  if (viewOnlyMode) return setStatus("Modo lectura: no se permiten cambios.", "error");

  try {
    btnGuardar.disabled = true; btnEnviar.disabled = true;
    document.querySelectorAll(".row--error").forEach(r => r.classList.remove("row--error"));
    
    const draft = collectDraft(isSubmit);
    if(!draft.updates.length && !draft.adds.length && !draft.narrAdds.length && !draft.narrUpdates.length && !deletedLocations.length) {
       setStatus("No hay cambios para guardar.", "info"); return;
    }
    
    await executeSave(draft);
    
    // Trazabilidad y auditoría
    const eventType = isSubmit ? "ENVIAR_REVISION" : "GUARDAR_BORRADOR";
    const detailMsg = `Actividad: ${elActividad.options[elActividad.selectedIndex].text}. Tareas afect: ${draft.adds.length + draft.updates.length}.`;
    await writeAuditEvent(eventType, "APP_REPORTE", draft.actGid, "OK", detailMsg);

    setStatus(isSubmit ? "Reporte enviado a revisión." : "Borrador guardado exitosamente.", "success");
    await loadExistingData(elActividad.value); 
    evaluateHistoricalMode();
  } catch(e) { 
      console.error(e); 
      setStatus(e.message, "error"); 
  } finally { 
      btnGuardar.disabled = false; btnEnviar.disabled = false; 
  }
}

function collectDraft(isSubmit) {
  const actGid = elActividad.value, vig = Number(elVigencia.value), per = elPeriodo.value;
  const epochNow = Date.now();
  const res = { actGid, adds: [], updates: [], ubicAdds: [], ubicUpdates: [], wfAdds: [], wfUpdates: [], narrAdds: [], narrUpdates: [] };
  
  // AVANCES TAREAS
  document.querySelectorAll(".row").forEach(rowEl => {
    if(rowEl.classList.contains("is-readonly")) return; 
    const tareaGid = rowEl.getAttribute("data-tarea-gid"), rowId = rowEl.getAttribute("data-row-id");
    const val = rowEl.querySelector(".row-valor")?.value, obs = rowEl.querySelector(".row-obs")?.value, evi = rowEl.querySelector(".row-evi")?.value;
    const motivo = rowEl.querySelector(".row-motivo")?.value;
    
    const locs = rowLocations.get(rowId) || [];
    locs.forEach(loc => { 
        const domLoc = document.getElementById(`loc-${loc.ptId}`); 
        if(domLoc) loc.desc = domLoc.querySelector(".loc-desc").value; 
        
        // REGLA 10: Validación Territorial CAR Estricta
        if (loc.mun === "Fuera de CAR" || !loc.mun) {
            rowEl.classList.add("row--error");
            throw new Error(`Existen ubicaciones fuera de la jurisdicción CAR en la tarea observada. Elimine o corrija el punto para poder continuar.`);
        }
    });

    if(!val && !obs && !evi && locs.length === 0) return; 

    const exist = existingAvances.get(tareaGid);
    
    // REGLA 4: Validación dura del MotivoAjuste para Devoluciones
    if (exist && exist.EstadoRegistro === "Devuelto" && (!motivo || motivo.trim() === "")) {
      rowEl.classList.add("row--error");
      throw new Error(`Debes diligenciar obligatoriamente el 'Motivo de ajuste' en la tarea devuelta.`);
    }

    const estadoNuevo = isSubmit ? "Enviado" : (exist ? exist.EstadoRegistro : "Borrador");
    
    const baseAttrs = {
      [F_AVA.estado]: estadoNuevo,
      [F_AVA.pEdic]: currentUser.pid,
      [F_AVA.fEdic]: epochNow,
      [F_AVA.motivo]: motivo || ""
    };

    let avanceGidFinal = null;
    let versionActual = 1;

    if(exist) {
      avanceGidFinal = exist.GlobalID;
      versionActual = (exist.Version || 1) + 1;
      baseAttrs.OBJECTID = exist.OBJECTID;
      baseAttrs[F_AVA.ver] = versionActual;
      baseAttrs[F_AVA.val] = val ? Number(val) : null; baseAttrs[F_AVA.obs] = obs; baseAttrs[F_AVA.evi] = evi;
      res.updates.push({ attributes: baseAttrs });
      
      if(String(exist.ValorReportado) !== String(val) || String(exist.Observaciones) !== String(obs)) {
          writeAuditHistory("REP_AvanceTarea", avanceGidFinal, "Edicion_Operativa", `Val:${exist.ValorReportado}`, `Val:${val}|Obs:${obs}`, motivo);
      }
    } else {
      avanceGidFinal = generateGUID();
      baseAttrs[F_AVA.fkTarea] = tareaGid; baseAttrs.Vigencia = vig; baseAttrs.Periodo = per;
      baseAttrs[F_AVA.ver] = versionActual; baseAttrs[F_AVA.val] = val ? Number(val) : null; baseAttrs[F_AVA.obs] = obs; baseAttrs[F_AVA.evi] = evi;
      baseAttrs.FechaRegistro = epochNow; baseAttrs.Responsable = currentUser.nombre;
      baseAttrs.GlobalID = avanceGidFinal; 
      res.adds.push({ attributes: baseAttrs });
      
      writeAuditHistory("REP_AvanceTarea", avanceGidFinal, "__CREATE__", "", `Val:${val}|Obs:${obs}`, "");
    }

    // Ubicaciones
    locs.forEach(pt => {
      const uAttrs = { [F_UBI.mun]: pt.mun, [F_UBI.dane]: pt.dane, [F_UBI.desc]: pt.desc, [F_UBI.fec]: epochNow };
      const geom = { x: pt.lon, y: pt.lat, spatialReference: { wkid: 4326 } };
      if(pt.isExisting) { uAttrs.OBJECTID = pt.ptId; res.ubicUpdates.push({ attributes: uAttrs, geometry: geom }); }
      else { uAttrs[F_UBI.fkAvance] = avanceGidFinal; res.ubicAdds.push({ attributes: uAttrs, geometry: geom }); }
    });

    // REGLA Workflow SolicitudRevision
    if(isSubmit) {
      const existingWf = existingWFSolicitudes.get(avanceGidFinal);
      const wfPayload = {
        [F_WF.tipo]: "AvanceTarea", [F_WF.objGid]: avanceGidFinal, [F_WF.vig]: vig, [F_WF.per]: per, [F_WF.persId]: currentUser.pid, [F_WF.fec]: epochNow, [F_WF.est]: "Enviado",
        ComentarioSolicitante: motivo ? `Corrección operativa: ${motivo}` : "Reporte operativo V3", Version: versionActual
      };

      if(existingWf) {
        wfPayload.OBJECTID = existingWf.OBJECTID;
        res.wfUpdates.push({ attributes: wfPayload });
      } else {
        wfPayload.GlobalID = generateGUID(); wfPayload.SolicitudID = generateGUID();
        res.wfAdds.push({ attributes: wfPayload });
      }
    }
  });

  // NARRATIVA
  if(!document.getElementById("txt-reporte-narrativo").disabled) {
    const txt1 = document.getElementById("txt-reporte-narrativo").value, txt2 = document.getElementById("txt-logros-descripcion").value, txt3 = document.getElementById("txt-logros-principales").value, motivoN = document.getElementById("txt-motivo-narrativa")?.value;
    if(txt1 || txt2 || txt3) {
      
      if (existingNarrativa && existingNarrativa.EstadoRegistro === "Devuelto" && (!motivoN || motivoN.trim() === "")) {
        throw new Error(`Debes diligenciar el 'Motivo de ajuste requerido' en la sección de Narrativa.`);
      }

      const estadoNuevoN = isSubmit ? "Enviado" : (existingNarrativa ? existingNarrativa.EstadoRegistro : "Borrador");
      const baseN = { [F_NAR.estado]: estadoNuevoN, [F_NAR.pEdic]: currentUser.pid, [F_NAR.fEdic]: epochNow, [F_NAR.motivo]: motivoN || "", [F_NAR.txt1]: txt1, [F_NAR.txt2]: txt2, [F_NAR.txt3]: txt3 };
      
      let narrGidFinal = null;
      let versionActualN = 1;

      if(existingNarrativa) {
        narrGidFinal = existingNarrativa.GlobalID; versionActualN = (existingNarrativa.Version || 1) + 1;
        baseN.OBJECTID = existingNarrativa.OBJECTID; baseN[F_NAR.ver] = versionActualN;
        res.narrUpdates.push({ attributes: baseN });
      } else {
        narrGidFinal = generateGUID(); baseN.GlobalID = narrGidFinal; baseN[F_NAR.fkAct] = actGid; baseN.Vigencia = vig; baseN.Periodo = per; baseN[F_NAR.ver] = versionActualN; baseN.FechaRegistro = epochNow; baseN.Responsable = currentUser.nombre;
        res.narrAdds.push({ attributes: baseN });
      }
      
      if(isSubmit) {
        const existingWfN = existingWFSolicitudes.get(narrGidFinal);
        const wfPayloadN = { [F_WF.tipo]: "ReporteNarrativo", [F_WF.objGid]: narrGidFinal, [F_WF.vig]: vig, [F_WF.per]: per, [F_WF.persId]: currentUser.pid, [F_WF.fec]: epochNow, [F_WF.est]: "Enviado", ComentarioSolicitante: motivoN ? `Corrección operativa: ${motivoN}` : "Reporte operativo V3", Version: versionActualN };
        
        if(existingWfN) { wfPayloadN.OBJECTID = existingWfN.OBJECTID; res.wfUpdates.push({ attributes: wfPayloadN }); } 
        else { wfPayloadN.GlobalID = generateGUID(); wfPayloadN.SolicitudID = generateGUID(); res.wfAdds.push({ attributes: wfPayloadN }); }
      }
    }
  }
  return res;
}

async function executeSave(draft) {
  if(draft.adds.length || draft.updates.length) await postForm(`${URL_AVANCE_TAREA}/applyEdits`, { f: "json", adds: draft.adds, updates: draft.updates });
  if(draft.ubicAdds.length || draft.ubicUpdates.length || deletedLocations.length) await postForm(`${URL_TAREA_UBICACION}/applyEdits`, { f:"json", adds: draft.ubicAdds, updates: draft.ubicUpdates, deletes: deletedLocations });
  if(draft.narrAdds.length || draft.narrUpdates.length) await postForm(`${URL_NARRATIVA}/applyEdits`, { f:"json", adds: draft.narrAdds, updates: draft.narrUpdates });
  if(draft.wfAdds.length || draft.wfUpdates.length) await postForm(`${URL_WF_SOLICITUD}/applyEdits`, { f:"json", adds: draft.wfAdds, updates: draft.wfUpdates });
}

// --- Limpieza UI ---
function clearForm(){
  if(document.getElementById("txt-reporte-narrativo")) document.getElementById("txt-reporte-narrativo").value = ""; if(document.getElementById("txt-logros-descripcion")) document.getElementById("txt-logros-descripcion").value = ""; if(document.getElementById("txt-logros-principales")) document.getElementById("txt-logros-principales").value = "";
  rowLocations.clear(); clearMapGraphics(); activeRowId = null; pillActive.textContent = "Registro activo: —";
  document.querySelectorAll(".row").forEach(r => {
    r.querySelector(".row-valor").value = ""; r.querySelector(".row-obs").value = ""; r.querySelector(".row-evi").value = "";
    const locList = r.querySelector(".loc-list"); if(locList) locList.innerHTML = "";
    r.classList.remove("row--error");
  });
}
btnLimpiar.addEventListener("click", () => { clearForm(); setStatus("Vista limpiada.", "info"); });

// --- Botón Recargar (Ajuste Final) ---
btnRefresh.addEventListener("click", async () => { 
    if(elVigencia.value && currentUser) {
        setStatus("Recargando asignaciones y actividades...", "info");
        clearForm();
        elIndicadores.innerHTML = "";
        document.getElementById("narrativa-badge-container").innerHTML = "";
        document.getElementById("container-motivo-narrativa").style.display = "none";
        elModo.style.display = "none";
        viewOnlyMode = false;
        elActividad.innerHTML = '<option value="">Cargando...</option>';

        await loadAsignaciones();
        await loadActividades();
        setStatus("Datos recargados correctamente.", "success");
    }
});

document.getElementById("btn-centrar").addEventListener("click", () => { view.goTo({ center: [-74.2, 4.7], zoom: 8 }); });

// Cambio de Vigencia (Recarga Asignaciones y Limpia Entorno)
elVigencia.addEventListener("change", async () => { 
    if(!currentUser) return;
    setStatus("Recargando asignaciones para la vigencia seleccionada...", "info");
    clearForm(); 
    elIndicadores.innerHTML = ""; 
    document.getElementById("narrativa-badge-container").innerHTML = "";
    document.getElementById("container-motivo-narrativa").style.display = "none";
    elModo.style.display = "none"; 
    viewOnlyMode = false;
    elActividad.innerHTML = '<option value="">Cargando...</option>';
    
    await loadAsignaciones(); 
    await loadActividades(); 
    setStatus("Asignaciones actualizadas.", "success");
});