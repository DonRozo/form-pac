/* ===========================================================
   DATA-PAC | Reporte y Corrección Operativa V4
   Esquema: DATAPAC_V4
   Mejoras (Final): Seguridad SEG_Alcance de GUID a GUID estricta, 
                    Inyección de UI para BI_AvanceSubActividad (SemaforoGestion), 
                    Respeto total de Aplica="No" y Estados,
                    Bypass de Prueba Total para SUPERADMIN.
                    Soporte Híbrido SEG_Asignacion (Actividad / Tarea).
                    Restauración Mapa y Combos de Selección Filtrables.
                    Corrección UX: Fila Georreferenciación (Selectores & Active Row).
                    Corrección UX 2: Delegación robusta y activación sin dependencia de histórico.
                    Corrección UX 3: Rediseño y alineación estética de tarjetas de ubicación.
                    Capa Mensajería UX Global e Inline.
                    Capa de Validaciones Previas Centralizadas.
                    Auditoría de Errores Técnicos y Funcionales.
                    Panel de Soporte Técnico y Diagnóstico UAT.
                    + Manejo Limpio Primer Cargue, Retorno Estructurado y Paginación.
                    + Contexto Histórico y Reglas Temporales de Solo Lectura OAP.
                    + Validación Funcional por TipoValorAvance (Numérico / Porcentaje).
                    + Validación Funcional por MetaProgramada.
                    + Modal Proxy de Confirmación Pre-Envío.
                    + Estabilización Network POST (Fix: URI Too Long) y Contexto OAP 2026.
                    + INYECCIÓN UI DE PESOS Y METAS DE PLANEACIÓN (ACT, SUB, TAR).
                    + CORRECCIÓN NORMALIZACIÓN GUID PARA CRUCE DE PESOS.
                    + ESTRATEGIA CLIENT-SIDE FILTERING Y PAGINACIÓN PARA PLAN_SUB Y PLAN_TAR.
                    + CORRECCIÓN CRÍTICA DE AISLAMIENTO PLAN/BI Y PROTECCIÓN ARRAY/JSON.
                    + FASE 2: REP_ReporteNarrativo como reporte consolidado de actividad.
                    + Captura de indicador anual, acumulado, porcentaje, ODS, Rezago y Reserva.
                    + INTEGRACIÓN WF: Creación dinámica de WF_SolicitudRevision centralizada en Actividad.
                    + FIX UAT FINAL: applyWorkflowEdits asilado, fallback WF_SolicitudRevision, GUID fixes en auditoría y actualización Clave/Version en fallback.
   =========================================================== */

const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V4/FeatureServer";
const CAR_SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/MpiosCAR/FeatureServer";
const CAR_JUR_LAYER_ID = 0; 

// URL PowerAutomate OTP (Debe parametrizarse antes de desplegar; con placeholder el OTP no funcionará)
const URL_WEBHOOK_POWERAUTOMATE = "URL_WEBHOOK_AQUI_NO_EXPONER_CREDENCIALES"; 

// Índices DATAPAC_V4
const getUrl = (id) => `${SERVICE_URL}/${id}`;
const URL_ACTIVIDAD = getUrl(6);
const URL_SUBACTIVIDAD = getUrl(7);
const URL_TAREA = getUrl(8);
const URL_AVANCE_TAREA = getUrl(9);
const URL_TAREA_UBICACION = getUrl(10); 
const URL_NARRATIVA = getUrl(11);
const URL_PLAN_SUB = getUrl(13);
const URL_PLAN_TAR = getUrl(14);
const URL_ASIGNACION = getUrl(15); 
const URL_PERSONA = getUrl(16); 
const URL_OTP = getUrl(17);
const URL_ROL = getUrl(21); 
const URL_ALCANCE = getUrl(22);
const URL_AUD_HISTORIAL = getUrl(23); 
const URL_AUD_EVENTO = getUrl(24); 
const URL_WF_SOLICITUD = getUrl(25);
const URL_BI_ACT = getUrl(28);
const URL_BI_SUB = getUrl(34);
const URL_BI_TAR = getUrl(35);
const URL_PLAN_ACT = getUrl(36);

const F_AVA = { fkTarea: "TareaGlobalID", vig: "Vigencia", per: "Periodo", val: "ValorReportado", obs: "Observaciones", evi: "EvidenciaURL", fec: "FechaRegistro", resp: "Responsable", estado: "EstadoRegistro", ver: "Version", fEdic: "FechaUltimaEdicionFuncional", pEdic: "PersonaUltimaEdicionID", motivo: "MotivoAjuste" };
const F_NAR = { fkAct: "ActividadGlobalID", vig: "Vigencia", per: "Periodo", txt1: "TextoNarrativo", txt2: "DescripcionLogrosAlcanzados", txt3: "PrincipalesLogros", fec: "FechaRegistro", resp: "Responsable", estado: "EstadoRegistro", ver: "Version", fEdic: "FechaUltimaEdicionFuncional", pEdic: "PersonaUltimaEdicionID", motivo: "MotivoAjuste", respGid: "ResponsableGlobalID", planAct: "PlanActividadGlobalID", indId: "IndicadorID", indNom: "NombreIndicador", indTipo: "TipoValorIndicador", indUnidad: "UnidadMedidaIndicador", indCalc: "TipoCalculoAvanceActividad", clave: "ClaveUnicaReporteActividad", meta: "MetaAnualIndicador", valTri: "ValorIndicadorTrimestre", valAcum: "ValorIndicadorAcumulado", pct: "PorcentajeAvanceIndicador", obsInd: "ObservacionIndicador", eviInd: "EvidenciaIndicadorURL", odsPlan: "ReportaODSPlan", odsTxt: "AvanceODSPeriodo", rezPlan: "ReportaRezagoPlan", rezTxt: "AvanceRezagoPeriodo", resPlan: "ReportaReservaPlan", resTxt: "AvanceReservaPeriodo" };
const F_UBI = { fkAvance: "AvanceTareaGlobalID", dane: "CodigoDANE", mun: "MunicipioNombre", desc: "DescripcionSitio", fec: "FechaRegistro" };

const F_WF = { 
  solId: "SolicitudID", 
  tipo: "TipoObjeto", 
  objId: "ObjetoID", 
  objGid: "ObjetoGlobalID", 
  vig: "Vigencia", 
  per: "Periodo", 
  persId: "PersonaSolicitaID", 
  fec: "FechaSolicitud", 
  est: "EstadoActual",
  ver: "Version",
  comentario: "ComentarioSolicitante",
  actGid: "ActividadGlobalID",
  planActGid: "PlanActividadGlobalID",
  repNarGid: "ReporteNarrativoGlobalID",
  dep: "DependenciaReportante",
  rolActual: "RolResponsableActual",
  personaRespActual: "PersonaResponsableActualID",
  etapaActual: "EtapaActual",
  fecUltMov: "FechaUltimoMovimiento",
  clave: "ClaveUnicaSolicitud",
  tipoFlujo: "TipoFlujoWorkflow",
  pasos: "PasosRequeridosWorkflow",
  pasoOrden: "PasoActualOrden"
};

const WORKFLOW_MATRIX = {
  COMPLETO: { estadoInicial: "EnVistoBuenoDirector", rolInicial: "VISTO_BUENO_AREA", etapaInicial: "VISTO_BUENO_DIRECTOR", pasos: ["VISTO_BUENO_AREA", "ENLACE_DEPENDENCIA", "APROBADOR_AREA", "REVISOR_OAP", "PUBLICADOR"] },
  SIN_DIRECTOR: { estadoInicial: "EnRevisionEnlace", rolInicial: "ENLACE_DEPENDENCIA", etapaInicial: "VALIDACION_ENLACE", pasos: ["ENLACE_DEPENDENCIA", "APROBADOR_AREA", "REVISOR_OAP", "PUBLICADOR"] },
  SIN_ENLACE: { estadoInicial: "EnVistoBuenoDirector", rolInicial: "VISTO_BUENO_AREA", etapaInicial: "VISTO_BUENO_DIRECTOR", pasos: ["VISTO_BUENO_AREA", "APROBADOR_AREA", "REVISOR_OAP", "PUBLICADOR"] },
  SIN_SUBDIRECTOR: { estadoInicial: "EnVistoBuenoDirector", rolInicial: "VISTO_BUENO_AREA", etapaInicial: "VISTO_BUENO_DIRECTOR", pasos: ["VISTO_BUENO_AREA", "ENLACE_DEPENDENCIA", "REVISOR_OAP", "PUBLICADOR"] },
  OAP_DIRECTO: { estadoInicial: "EnRevisionOAP", rolInicial: "REVISOR_OAP", etapaInicial: "REVISION_OAP", pasos: ["REVISOR_OAP", "PUBLICADOR"] },
  PUBLICACION_DIRECTA: { estadoInicial: "AprobadoOAP", rolInicial: "PUBLICADOR", etapaInicial: "PUBLICACION", pasos: ["PUBLICADOR"] },
  OPERATIVO_SIMPLE: { estadoInicial: "EnRevisionOAP", rolInicial: "REVISOR_OAP", etapaInicial: "REVISION_OAP", pasos: ["REVISOR_OAP"] },
  ESPECIAL: { estadoInicial: "EnRevisionOAP", rolInicial: "REVISOR_OAP", etapaInicial: "REVISION_OAP", pasos: ["REVISOR_OAP"] }
};

// --- REGLAS DE NEGOCIO TEMPORALES ---
const OPERATIVE_VIGENCIA = 2026; 
const OPERATIVE_PERIODO = 'T1';  

// DOM
const elVigencia = document.getElementById("sel-vigencia"), elPeriodo = document.getElementById("sel-periodo"), elIndicadores = document.getElementById("indicadores");
const btnGuardar = document.getElementById("btn-guardar"), btnEnviar = document.getElementById("btn-enviar"), btnLimpiar = document.getElementById("btn-limpiar"), btnRefresh = document.getElementById("btn-refresh");
const elStatus = document.getElementById("status"), pillActive = document.getElementById("pill-active");
const elModo = document.getElementById("pill-modo"), actContextPanel = document.getElementById("actividad-context");
const elSubactNav = document.getElementById("subact-nav-bar");
const elTopSubactSelector = document.getElementById("top-subact-selector");

// UI Variables Drawer Mapa
const elMapDrawer = document.getElementById("map-drawer");
const elMapOverlay = document.getElementById("map-overlay");
const btnCloseMap = document.getElementById("btn-close-map");

// Drawer Map Helpers
function openMapDrawer() {
    if(elMapDrawer) elMapDrawer.classList.add("open");
    if(elMapOverlay) elMapOverlay.classList.add("open");
    setTimeout(() => { if (view) view.resize(); }, 450);
}

function closeMapDrawer() {
    if(elMapDrawer) elMapDrawer.classList.remove("open");
    if(elMapOverlay) elMapOverlay.classList.remove("open");
}

if(btnCloseMap) btnCloseMap.addEventListener("click", closeMapDrawer);
if(elMapOverlay) elMapOverlay.addEventListener("click", closeMapDrawer);
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMapDrawer(); });

// Eventos de Navegación por Subactividades
if(document.getElementById("btn-expand-all")) {
    document.getElementById("btn-expand-all").addEventListener("click", () => document.querySelectorAll(".card").forEach(c => c.classList.remove("collapsed")));
    document.getElementById("btn-collapse-all").addEventListener("click", () => document.querySelectorAll(".card").forEach(c => c.classList.add("collapsed")));
    document.getElementById("btn-go-top").addEventListener("click", () => {
        const topEl = document.getElementById("panel-header-tareas");
        if (topEl) topEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("btn-go-bottom").addEventListener("click", () => {
        const bottomEl = document.getElementById("panel-header-narrativa");
        if (bottomEl) bottomEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

// Selector Top de Subactividades
if(elTopSubactSelector) {
    elTopSubactSelector.addEventListener("change", (e) => {
        const targetId = e.target.value;
        if (!targetId) return;
        const cardEl = document.getElementById(targetId);
        if (cardEl) {
            cardEl.classList.remove("collapsed");
            cardEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        e.target.value = ""; 
    });
}

function populateTopSubactSelector() {
    if (!elTopSubactSelector) return;
    const cards = elIndicadores.querySelectorAll(".card");
    if (cards.length === 0) {
        elTopSubactSelector.style.display = "none";
        elTopSubactSelector.innerHTML = '<option value="">Ir a subactividad...</option>';
        return;
    }
    
    elTopSubactSelector.style.display = "block";
    let html = '<option value="">Ir a subactividad...</option>';
    cards.forEach((card, index) => {
        const cardId = `subact-card-${index}`;
        card.id = cardId;
        const titleEl = card.querySelector(".card__title");
        const titleText = titleEl ? titleEl.textContent : `Subactividad ${index + 1}`;
        const shortTitle = titleText.length > 50 ? titleText.substring(0, 47) + "..." : titleText;
        html += `<option value="${cardId}">${shortTitle}</option>`;
    });
    elTopSubactSelector.innerHTML = html;
}

window.toggleAccordion = function(cardEl) { if (cardEl) cardEl.classList.toggle('collapsed'); };

// Inicializar selectores de UI con el Contexto Operativo
elVigencia.value = OPERATIVE_VIGENCIA;
elPeriodo.value = OPERATIVE_PERIODO;

// Estado Global
let currentUser = null; 
let asignacionesActivas = []; 
let cacheSubactividades = [], cacheTareas = [];
let cacheActividadesPesos = new Map(); 
let planActCtx = null, biActCtx = null;
let planSubCtx = new Map(), biSubCtx = new Map();
let planTarCtx = new Map(), biTarCtx = new Map();
let existingAvances = new Map(); 
let existingNarrativa = null; 
let indicatorPriorAccumulated = 0;
let existingWFSolicitudes = new Map(); 
let deletedLocations = []; 
let rowLocations = new Map(); 
let activeRowId = null;
let viewOnlyMode = false;
let map, view, graphicsLayer, webMercatorUtils, sketchVM, jurisdiccionLayerView;

let lastCapturedError = null;
let lastGlobalMsg = null;

// Diagnósticos de filtrado
let diagSubsVis = 0, diagSubsLoad = 0, diagSubsMatch = 0;
let diagTarsVis = 0, diagTarsLoad = 0, diagTarsMatch = 0;

function getTemporalScore(v, p) { return parseInt(v) * 10 + parseInt(String(p).replace('T', '')); }

function evaluateHistoricalSelection(selectedVigencia, selectedPeriodo) {
    const v = parseInt(selectedVigencia);
    const selScore = getTemporalScore(v, selectedPeriodo);
    const currScore = getTemporalScore(OPERATIVE_VIGENCIA, OPERATIVE_PERIODO);

    let isFuture = v > OPERATIVE_VIGENCIA || selScore > currScore;
    let isPastVigencia = v < OPERATIVE_VIGENCIA;
    let isPastQuarter = v === OPERATIVE_VIGENCIA && selScore < currScore;
    let isCurrent = selScore === currScore;

    return { isFuture, isPastVigencia, isPastQuarter, isCurrent, v, p: selectedPeriodo };
}

function getTipoValorAvanceByTarea(tareaGid) {
    if (!cacheTareas || cacheTareas.length === 0) return "";
    const task = cacheTareas.find(t => t.GlobalID === tareaGid);
    if (!task || !task.TipoValorAvance) return "";
    return String(task.TipoValorAvance).toUpperCase().trim();
}

function getMetaProgramadaByTarea(tareaGid) {
    const pTar = planTarCtx.get(normalizeGuidKey(tareaGid));
    if (!pTar || pTar.MetaProgramada === null || pTar.MetaProgramada === undefined || String(pTar.MetaProgramada).trim() === '') return null;
    const meta = Number(pTar.MetaProgramada);
    return isNaN(meta) ? null : meta;
}

// --- FASE 2: REPORTE CONSOLIDADO DE ACTIVIDAD ---
const PERIOD_ORDER = ["T1", "T2", "T3", "T4"];

function byId(id) { return document.getElementById(id); }

function normalizeSiNo(value, defaultValue = "NO") {
    const raw = String(value ?? "").trim().toUpperCase();
    if (["SI", "SÍ", "TRUE", "1", "YES"].includes(raw)) return "SI";
    if (["NO", "FALSE", "0"].includes(raw)) return "NO";
    return defaultValue;
}

function getPlanFlag(fieldName) { return normalizeSiNo(planActCtx?.[fieldName], "NO"); }

function getPlanTipoIndicador() {
    const tipo = normalizeText(planActCtx?.TipoValorIndicador || "NUMERICO");
    if (tipo.includes("PORC")) return "PORCENTUAL";
    return "NUMERICO";
}

function getPlanMetaAnual() {
    if (!planActCtx || planActCtx.MetaProgramada === null || planActCtx.MetaProgramada === undefined || String(planActCtx.MetaProgramada).trim() === "") return null;
    const meta = Number(planActCtx.MetaProgramada);
    return Number.isFinite(meta) ? meta : null;
}

function isIndicadorActivoEnPlan() {
    return !!(planActCtx && normalizeSiNo(planActCtx.Aplica, "SI") !== "NO" && (planActCtx.IndicadorID || planActCtx.NombreIndicador || getPlanMetaAnual() !== null));
}

function formatNumberForUi(value, decimals = 2) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
    const n = Number(value);
    if (Number.isInteger(n)) return String(n);
    return String(Number(n.toFixed(decimals)));
}

function getCurrentIndicadorValue() {
    const el = byId("txt-valor-indicador");
    if (!el || el.value === "" || el.value === null || el.value === undefined) return null;
    const num = Number(el.value);
    return Number.isFinite(num) ? num : null;
}

function calculateIndicadorValues(currentValue = getCurrentIndicadorValue()) {
    const tipo = getPlanTipoIndicador();
    const meta = getPlanMetaAnual();
    if (currentValue === null) return { current: null, accumulated: null, pct: null, meta, tipo };

    let accumulated;
    let pct;
    if (tipo === "PORCENTUAL") {
        accumulated = currentValue;
        pct = currentValue;
    } else {
        accumulated = Number(indicatorPriorAccumulated || 0) + currentValue;
        pct = meta && meta > 0 ? (accumulated / meta) * 100 : null;
    }
    return { current: currentValue, accumulated, pct, meta, tipo };
}

function updateIndicatorCalculatedUI() {
    const calc = calculateIndicadorValues();
    const priorEl = byId("calc-valor-previo");
    const acumEl = byId("calc-valor-acumulado");
    const pctEl = byId("calc-porcentaje-indicador");
    if (priorEl) priorEl.value = formatNumberForUi(indicatorPriorAccumulated || 0);
    if (acumEl) acumEl.value = calc.accumulated === null ? "" : formatNumberForUi(calc.accumulated);
    if (pctEl) pctEl.value = calc.pct === null ? "" : `${formatNumberForUi(calc.pct)}%`;
}

function setConsolidatedFieldsDisabled(disabled) {
    [
        "txt-valor-indicador",
        "txt-observacion-indicador",
        "txt-evidencia-indicador",
        "txt-avance-ods",
        "txt-avance-rezago",
        "txt-avance-reserva"
    ].forEach(id => {
        const el = byId(id);
        if (el) el.disabled = disabled;
    });
}

function clearReporteConsolidadoFields(clearValues = true) {
    if (clearValues) {
        [
            "txt-valor-indicador",
            "txt-observacion-indicador",
            "txt-evidencia-indicador",
            "txt-avance-ods",
            "txt-avance-rezago",
            "txt-avance-reserva",
            "calc-valor-previo",
            "calc-valor-acumulado",
            "calc-porcentaje-indicador"
        ].forEach(id => { const el = byId(id); if (el) el.value = ""; });
    }
    const warn = byId("indicador-warning");
    if (warn) { warn.style.display = "none"; warn.textContent = ""; }
}

function syncReporteConsolidadoUI() {
    const blockIndicador = byId("bloque-indicador-actividad");
    const ctx = byId("indicador-contexto");
    const blockEspeciales = byId("bloque-componentes-especiales");
    const blockOds = byId("bloque-ods");
    const blockRezago = byId("bloque-rezago");
    const blockReserva = byId("bloque-reserva");
    const emptyEspeciales = byId("componentes-especiales-empty");

    const hasPlan = !!planActCtx;
    const indicadorActivo = isIndicadorActivoEnPlan();
    if (blockIndicador) blockIndicador.style.display = indicadorActivo ? "block" : "none";

    if (ctx && indicadorActivo) {
        const tipo = getPlanTipoIndicador();
        const meta = getPlanMetaAnual();
        ctx.innerHTML = `
            <span class="ctx-badge">Indicador: ${escapeHtml(planActCtx.IndicadorID || "N/A")}</span>
            <span class="ctx-badge">Nombre: ${escapeHtml(planActCtx.NombreIndicador || "Sin nombre")}</span>
            <span class="ctx-badge">Unidad: ${escapeHtml(planActCtx.UnidadMedida || "N/A")}</span>
            <span class="ctx-badge">Tipo: ${tipo}</span>
            <span class="ctx-badge">Meta anual: ${meta !== null ? formatNumberForUi(meta) : "N/D"}</span>
            <span class="ctx-badge">Fuente avance: ${escapeHtml(planActCtx.TipoCalculoAvanceActividad || "N/D")}</span>
        `;
    }

    const reportaODS = hasPlan && getPlanFlag("ReportaODS") === "SI";
    const reportaRezago = hasPlan && getPlanFlag("ReportaRezago") === "SI";
    const reportaReserva = hasPlan && getPlanFlag("ReportaReserva") === "SI";
    const anyEspecial = reportaODS || reportaRezago || reportaReserva;

    if (blockEspeciales) blockEspeciales.style.display = hasPlan ? "block" : "none";
    if (blockOds) blockOds.style.display = reportaODS ? "block" : "none";
    if (blockRezago) blockRezago.style.display = reportaRezago ? "block" : "none";
    if (blockReserva) blockReserva.style.display = reportaReserva ? "block" : "none";
    if (emptyEspeciales) emptyEspeciales.style.display = hasPlan && !anyEspecial ? "block" : "none";

    updateIndicatorCalculatedUI();
}

async function fetchIndicadorPriorAccumulated(actGid, vig, periodo) {
    const idx = PERIOD_ORDER.indexOf(periodo);
    if (!actGid || !vig || idx <= 0) return 0;
    const priorPeriods = PERIOD_ORDER.slice(0, idx).map(p => `'${p}'`).join(",");
    if (!priorPeriods) return 0;
    try {
        const q = await fetchJson(`${URL_NARRATIVA}/query`, {
            f: "json",
            where: `ActividadGlobalID='${actGid}' AND Vigencia=${vig} AND Periodo IN (${priorPeriods})`,
            outFields: "Periodo,ValorIndicadorTrimestre",
            returnGeometry: false
        });
        return (q.features || []).reduce((sum, f) => {
            const val = Number(f.attributes?.ValorIndicadorTrimestre);
            return sum + (Number.isFinite(val) ? val : 0);
        }, 0);
    } catch (e) {
        console.warn("No fue posible calcular acumulado previo del indicador.", e);
        auditError("CALC_INDICADOR_PREVIO", e, { actGid, vig, periodo });
        return 0;
    }
}

function populateReporteConsolidadoFromExisting(nar) {
    const setVal = (id, val) => { const el = byId(id); if (el) el.value = val ?? ""; };
    setVal("txt-valor-indicador", nar?.ValorIndicadorTrimestre);
    setVal("txt-observacion-indicador", nar?.ObservacionIndicador);
    setVal("txt-evidencia-indicador", nar?.EvidenciaIndicadorURL);
    setVal("txt-avance-ods", nar?.AvanceODSPeriodo);
    setVal("txt-avance-rezago", nar?.AvanceRezagoPeriodo);
    setVal("txt-avance-reserva", nar?.AvanceReservaPeriodo);
    updateIndicatorCalculatedUI();
}

function bindReporteConsolidadoEvents() {
    const valEl = byId("txt-valor-indicador");
    if (valEl) valEl.addEventListener("input", updateIndicatorCalculatedUI);
}

bindReporteConsolidadoEvents();

// --- PANEL DE SOPORTE (SUPERADMIN) ---
function refreshSupportPanel() {
    if (!currentUser || !currentUser.isSuperAdmin) return;
    
    document.getElementById("panel-soporte").style.display = "block";
    
    const nodes = document.querySelectorAll(".row").length;
    const locked = document.querySelectorAll(".row.is-readonly:not(.is-not-applicable)").length;
    const notApp = document.querySelectorAll(".row.is-not-applicable").length;
    
    const comboInput = document.querySelector("#combo-actividad .combo-input");
    const actName = comboInput ? (comboInput.value || "Ninguna") : "Ninguna";
    const actGid = getActividadId() || "Ninguna";
    
    document.getElementById("sup-user").textContent = currentUser.nombre;
    document.getElementById("sup-roles").textContent = currentUser.roles.join(", ");
    document.getElementById("sup-act-name").textContent = actName;
    document.getElementById("sup-act-gid").textContent = actGid;
    document.getElementById("sup-vp").textContent = `${elVigencia.value} / ${getPeriodo()}`;
    document.getElementById("sup-nodes").textContent = nodes;
    document.getElementById("sup-locked").textContent = locked;
    document.getElementById("sup-na").textContent = notApp;
    
    document.getElementById("sup-diag-subs").textContent = `${diagSubsVis} / ${diagSubsLoad} / ${diagSubsMatch}`;
    document.getElementById("sup-diag-tars").textContent = `${diagTarsVis} / ${diagTarsLoad} / ${diagTarsMatch}`;
    document.getElementById("sup-msg").textContent = lastGlobalMsg || "Ninguno";
    
    const errEl = document.getElementById("sup-err");
    if (lastCapturedError) {
        errEl.textContent = typeof lastCapturedError === 'object' ? JSON.stringify(lastCapturedError) : String(lastCapturedError);
        errEl.style.display = "block";
    } else {
        errEl.textContent = "Ninguno";
    }
}

document.getElementById("btn-toggle-soporte").addEventListener("click", () => {
    const body = document.getElementById("support-body");
    const icon = document.getElementById("support-toggle-icon");
    if (body.style.display === "none") {
        body.style.display = "block";
        icon.textContent = "▲";
        refreshSupportPanel();
    } else {
        body.style.display = "none";
        icon.textContent = "▼";
    }
});

document.getElementById("btn-copy-diagnostico").addEventListener("click", () => {
    const actGid = getActividadId();
    const comboInput = document.querySelector("#combo-actividad .combo-input");
    const actName = comboInput ? (comboInput.value || "Ninguna") : "Ninguna";
    
    const data = `
DATA-PAC V4 | DIAGNÓSTICO UAT
-----------------------------
Usuario: ${currentUser?.nombre}
Roles: ${currentUser?.roles.join(", ")}
Contexto: ${elVigencia.value} | ${getPeriodo()}
Actividad Seleccionada: ${actName}
Actividad GID: ${actGid}
Total Tareas UI (Renderizadas): ${document.querySelectorAll(".row").length}
Tareas Bloqueadas: ${document.querySelectorAll(".row.is-readonly:not(.is-not-applicable)").length}
Tareas No Aplicables: ${document.querySelectorAll(".row.is-not-applicable").length}
Diag. Subs (Vis/Load/Match): ${diagSubsVis} / ${diagSubsLoad} / ${diagSubsMatch}
Diag. Tars (Vis/Load/Match): ${diagTarsVis} / ${diagTarsLoad} / ${diagTarsMatch}
Último Mensaje Global: ${lastGlobalMsg}
Último Error Técnico: ${typeof lastCapturedError === 'object' ? JSON.stringify(lastCapturedError) : String(lastCapturedError)}
`.trim();
    navigator.clipboard.writeText(data).then(() => {
        const btn = document.getElementById("btn-copy-diagnostico");
        const prev = btn.textContent;
        btn.textContent = "¡Copiado!";
        setTimeout(() => btn.textContent = prev, 2000);
    });
});

// --- CAPA DE AUDITORÍA DE ERRORES GLOBAL ---
async function auditError(context, error, extra = {}) {
    lastCapturedError = { context, error: error instanceof Error ? error.message : String(error), extra };
    refreshSupportPanel();

    if (error && typeof error === 'object' && error._audited) return; 
    
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    let pid = currentUser ? currentUser.pid : null;
    let detailStr = `[${context}] ERR: ${errorMsg} | CTX: ${JSON.stringify(extra)}`;
    if (!currentUser) detailStr = `[NO_AUTH] ${detailStr}`;
    const detail = detailStr.substring(0, 500);
    
    console.error(`[AUDIT ERROR] ${context}:`, error, extra);
    
    if (error && typeof error === 'object') {
        try { error._audited = true; } catch(err) {}
    }
    
    try {
        const attrs = {
            EventoID: generateGUID(),
            Modulo: "APP_REPORTE",
            Evento: `ERR_${context}`.substring(0, 100),
            Resultado: "ERROR",
            FechaEvento: Date.now(),
            PersonaID: pid,
            Detalle: detail,
            IP: "N/A",
            UserAgent: navigator.userAgent.substring(0, 255)
        };
        
        const form = new URLSearchParams();
        form.append("f", "json");
        form.append("adds", JSON.stringify([{attributes: attrs}]));
        
        await fetch(`${URL_AUD_EVENTO}/applyEdits`, { method: "POST", body: form });
    } catch(e) {
        console.error("[AUDIT ERROR] Falló el registro de auditoría en la tabla. Silenciando error local.", e);
    }
}

window.onerror = function (msg, url, lineNo, columnNo, error) {
    auditError("GLOBAL_WINDOW", error || msg, { lineNo, columnNo });
    return false;
};

window.onunhandledrejection = function (event) {
    auditError("UNHANDLED_PROMISE", event.reason || "Rechazo de promesa sin razón");
};

// --- Helpers UX ---
function showGlobalMessage(text, type = "info") {
    lastGlobalMsg = `[${type.toUpperCase()}] ${text}`;
    refreshSupportPanel();

    const el = document.getElementById("status");
    if (!el) return;
    el.className = `status-global msg--${type}`;
    el.textContent = text;
    el.style.display = "block";
    if (type === "success") {
        setTimeout(() => { if (el.textContent === text) el.style.display = "none"; }, 5000);
    }
}
function clearGlobalMessage() { const el = document.getElementById("status"); if (el) el.style.display = "none"; }
function showRowMessage(rowId, text, type = "info") { const container = document.getElementById(`msg-container-${rowId}`); if (container) container.innerHTML = `<div class="msg-inline msg--${type}">${text}</div>`; }
function clearRowMessage(rowId) { const container = document.getElementById(`msg-container-${rowId}`); if (container) container.innerHTML = ""; }
function showNarrativeMessage(text, type = "info") { const el = document.getElementById("msg-narrativa"); if (!el) return; el.className = `msg-inline msg--${type}`; el.textContent = text; el.style.display = "flex"; }
function clearNarrativeMessage() { const el = document.getElementById("msg-narrativa"); if (el) el.style.display = "none"; }

function setStatus(msg, type="info"){ showGlobalMessage(msg, type); }
function escapeHtml(s){ return (s??"").toString().replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function toYesNo(v){ const s=(v||"").toString().toLowerCase(); return (s==="si"||s==="sí"||s==="true")?true:(s==="no"||s==="false"?false:null); }
function generateGUID() { return '{' + crypto.randomUUID().toUpperCase() + '}'; }

// --- HELPER: NORMALIZADOR DE GUID ---
function normalizeGuidKey(v) { 
  return String(v || "").replace(/[{}]/g, "").trim().toLowerCase(); 
}

function normalizeGuidLiteral(v) {
  const key = normalizeGuidKey(v);
  return key ? `{${key.toUpperCase()}}` : null;
}

function uniqueGuidList(values) {
  const map = new Map();
  (values || []).forEach(v => {
    const lit = normalizeGuidLiteral(v);
    if (lit) map.set(normalizeGuidKey(lit), lit);
  });
  return [...map.values()];
}

function normalizeText(v) {
  return String(v || "").trim().toUpperCase();
}

function normalizeRole(role) {
  const r = normalizeText(role);
  if (r === "APROBADOR") return "APROBADOR_AREA";
  if (r === "PUBLICADOR OAP") return "PUBLICADOR";
  if (r === "VISUALIZADOR OAP") return "VISUALIZADOR";
  return r;
}

function hasRoleInList(roles, role) {
  const normalized = normalizeRole(role);
  return (roles || []).map(normalizeRole).includes(normalized);
}

function isEditorOnlyRoleSet(roles) {
  const normalized = (roles || []).map(normalizeRole).filter(Boolean);
  return normalized.includes("EDITOR") && normalized.every(r => r === "EDITOR");
}

function buildGuidWhere(fieldName, guidValue) {
  const literal = normalizeGuidLiteral(guidValue);
  const bare = normalizeGuidKey(guidValue).toUpperCase();
  if (!literal || !bare) return "1=0";
  return `(${fieldName}='${literal}' OR ${fieldName}='${bare}')`;
}

// --- Funciones Base (Técnicas) ---
async function fetchJson(url, params){ 
    try {
        const form = new URLSearchParams();
        Object.entries(params||{}).forEach(([k,v])=>{ if(v!=null) form.append(k,v); }); 
        const r = await fetch(url, {method:"POST", body:form}); 
        if(!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); 
        const data = await r.json();
        if(data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data; 
    } catch(e) {
        if (!url.includes(URL_AUD_EVENTO) && !url.includes(URL_AUD_HISTORIAL)) {
            auditError("FETCH_JSON", e, { url: url.substring(0, 150) });
        }
        throw e;
    }
}

// --- HELPER DE PAGINACIÓN POST ---
async function fetchAllByWhere(url, where, outFields = "*") {
    let allFeatures = [];
    let offset = 0;
    const limit = 2000;
    let hasMore = true;

    while (hasMore) {
        const params = {
            f: "json",
            where: where,
            outFields: outFields,
            returnGeometry: false,
            resultOffset: offset,
            resultRecordCount: limit
        };
        const response = await fetchJson(`${url}/query`, params);
        const features = response.features || [];
        if (features.length > 0) {
            allFeatures.push(...features);
            offset += limit;
            if (features.length < limit || response.exceededTransferLimit === false) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    return allFeatures;
}

async function postForm(url, formObj){ 
    try {
        const form=new URLSearchParams(); Object.entries(formObj).forEach(([k,v])=>{ if(v!=null) form.append(k,typeof v==="string"?v:JSON.stringify(v)); }); 
        const r=await fetch(url, {method:"POST", body:form}); 
        if(!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); 
        const data = await r.json();
        if(data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data; 
    } catch(e) {
        if (!url.includes(URL_AUD_EVENTO) && !url.includes(URL_AUD_HISTORIAL)) {
            auditError("POST_FORM", e, { url: url.substring(0, 150) });
        }
        throw e;
    }
}

// --- Lógica de Estado Individual V4 ---
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

function isTaskReadonly(rowId) {
    if (viewOnlyMode) return true;
    if (!rowId) return true;
    const rowEl = document.querySelector(`.row[data-row-id="${rowId}"]`);
    if (!rowEl) return true;
    return rowEl.classList.contains("is-readonly") || rowEl.classList.contains("is-not-applicable");
}

// --- CORE: Listas Filtrables (Combos) ---
function renderCombo(containerId, data, placeholder, onChange) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = `<div class="combo-wrap"><input type="text" class="combo-input" placeholder="${placeholder}" autocomplete="off" /><input type="hidden" class="combo-value" /><span class="combo-clear" title="Limpiar">×</span><div class="combo-list"></div></div>`;
    const input = container.querySelector(".combo-input"), hidden = container.querySelector(".combo-value"), list = container.querySelector(".combo-list"), clear = container.querySelector(".combo-clear");

    const renderList = (filter = "") => {
        const f = filter.toLowerCase(); const filtered = data.filter(d => d.label.toLowerCase().includes(f));
        if(!filtered.length) { list.innerHTML = `<div class="combo-option combo-empty">Sin resultados</div>`; return; }
        list.innerHTML = filtered.map(d => `<div class="combo-option" data-val="${d.value}">${escapeHtml(d.label)}</div>`).join("");
    };

    input.addEventListener("focus", () => { renderList(input.value); list.style.display = "block"; });
    input.addEventListener("input", (e) => { renderList(e.target.value); list.style.display = "block"; clear.style.display = input.value ? "block" : "none"; });
    document.addEventListener("click", (e) => { if(!container.contains(e.target)) { list.style.display = "none"; if(!hidden.value) { input.value = ""; clear.style.display = "none"; } } });
    list.addEventListener("click", (e) => { if(e.target.classList.contains("combo-option") && !e.target.classList.contains("combo-empty")) { const val = e.target.getAttribute("data-val"); input.value = e.target.textContent; hidden.value = val; list.style.display = "none"; clear.style.display = "block"; if(onChange) onChange(val); } });
    clear.addEventListener("click", () => { input.value = ""; hidden.value = ""; clear.style.display = "none"; if(onChange) onChange(""); input.focus(); });
}

function setComboValue(containerId, value, label) {
    const container = document.getElementById(containerId); if(!container) return;
    const input = container.querySelector(".combo-input"), hidden = container.querySelector(".combo-value"), clear = container.querySelector(".combo-clear");
    if(input) input.value = label || ""; if(hidden) hidden.value = value || ""; if(clear) clear.style.display = value ? "block" : "none";
}

function getActividadId() { const h = document.querySelector("#combo-actividad .combo-value"); return h ? h.value : ""; }
function getPeriodo() { return elPeriodo.value || OPERATIVE_PERIODO; }

function initCombosFijos() { renderCombo("combo-actividad", [], "Cargando..."); }

// --- Funciones de Historial y Auditoria ---
async function writeAuditEvent(evento, modulo, resultado, detalle) {
  if (!currentUser) return;
  try {
    const attrs = { 
        EventoID: generateGUID(), 
        Modulo: modulo, 
        Evento: evento, 
        Resultado: resultado, 
        FechaEvento: Date.now(),
        PersonaID: currentUser.pid, 
        Detalle: detalle ? detalle.substring(0, 500) : "", 
        IP: "N/A", 
        UserAgent: navigator.userAgent.substring(0, 255) 
    };
    await postForm(`${URL_AUD_EVENTO}/applyEdits`, { adds: [{attributes: attrs}] });
  } catch(e) { console.error("[AUDIT_SYSTEM] Error al guardar evento:", e); }
}

async function writeAuditHistory(tipoObj, objGid, campo, valAnt, valNuevo, motivo) {
  if (!currentUser) return;
  try {
    const attrs = { GlobalID: generateGUID(), TipoObjeto: tipoObj, ObjetoID: "0", ObjetoGlobalID: objGid || "", CampoModificado: campo || "", ValorAnterior: valAnt ? String(valAnt).substring(0, 1000) : "", ValorNuevo: valNuevo ? String(valNuevo).substring(0, 1000) : "", PersonaID: currentUser.pid, FechaCambio: Date.now(), MotivoCambio: motivo || "", OrigenCambio: "APP_REPORTE" };
    await postForm(`${URL_AUD_HISTORIAL}/applyEdits`, { adds: [{attributes: attrs}] });
  } catch(e) { console.error("[AUDIT_SYSTEM] Error al guardar historial:", e); }
}

// --- RESOLUCION E INYECCION WORKFLOW V4 ---

function buildWorkflowSequence(planAct) {
    let rawTipo = planAct && planAct.TipoFlujoWorkflow ? normalizeText(planAct.TipoFlujoWorkflow) : "";
    let usedFallback = false;

    if (!rawTipo || !WORKFLOW_MATRIX[rawTipo]) {
        rawTipo = "COMPLETO";
        usedFallback = true;
    }

    const conf = WORKFLOW_MATRIX[rawTipo];
    return {
        tipoFlujoWorkflow: rawTipo,
        estadoInicial: conf.estadoInicial,
        rolInicial: conf.rolInicial,
        etapaInicial: conf.etapaInicial,
        pasosArray: conf.pasos,
        pasosRequeridosWorkflow: conf.pasos.join("|"),
        pasoActualOrden: 1,
        usedFallback: usedFallback
    };
}

async function resolvePlanActividadWorkflow(actividadGlobalID, vigencia) {
    try {
        const where = `ActividadGlobalID='${normalizeGuidLiteral(actividadGlobalID)}' AND Vigencia=${vigencia}`;
        const q = await fetchJson(`${URL_PLAN_ACT}/query`, {
            f: "json",
            where: where,
            outFields: "*"
        });
        if (q && q.features && q.features.length > 0) return q.features[0].attributes;
        return null;
    } catch (error) {
        auditError("RESOLVE_PLAN_ACT", error, { actividadGlobalID, vigencia });
        return null;
    }
}

async function resolveNarrativaAfterSave({ actividadGlobalID, vigencia, periodo, version, claveUnicaReporteActividad }) {
    try {
        if (claveUnicaReporteActividad) {
            let q = await fetchJson(`${URL_NARRATIVA}/query`, {
                f: "json",
                where: `ClaveUnicaReporteActividad='${claveUnicaReporteActividad}'`,
                outFields: "*",
                orderByFields: "FechaRegistro DESC"
            });
            if (q && q.features && q.features.length > 0) return q.features[0].attributes;
        }

        let fallbackWhere = `ActividadGlobalID='${normalizeGuidLiteral(actividadGlobalID)}' AND Vigencia=${vigencia} AND Periodo='${periodo}'`;
        if (version) fallbackWhere += ` AND Version=${version}`;

        const qFall = await fetchJson(`${URL_NARRATIVA}/query`, {
            f: "json",
            where: fallbackWhere,
            outFields: "*",
            orderByFields: "FechaRegistro DESC"
        });
        if (qFall && qFall.features && qFall.features.length > 0) return qFall.features[0].attributes;

        return null;
    } catch (error) {
        auditError("RESOLVE_NARRATIVA", error, { actividadGlobalID, vigencia, periodo, version });
        return null;
    }
}

async function findExistingWorkflowSolicitud(claveUnicaSolicitud, narrativaAttrs) {
    try {
        let q = await fetchJson(`${URL_WF_SOLICITUD}/query`, {
            f: "json",
            where: `ClaveUnicaSolicitud='${claveUnicaSolicitud}'`,
            outFields: "*"
        });

        if (q && q.features && q.features.length > 0) {
            if (q.features.length > 1) await writeAuditEvent("WF_SOLICITUD_DUPLICADA_EVITADA", "APP_REPORTE", "ADVERTENCIA", `Múltiples solicitudes encontradas para clave única.`);
            return q.features[0].attributes;
        }

        if (narrativaAttrs) {
            let fallbackWhere = "";
            if (narrativaAttrs.GlobalID) {
                fallbackWhere = `ReporteNarrativoGlobalID='${normalizeGuidLiteral(narrativaAttrs.GlobalID)}'`;
            } else if (narrativaAttrs.ActividadGlobalID && narrativaAttrs.Vigencia && narrativaAttrs.Periodo) {
                fallbackWhere = `ActividadGlobalID='${normalizeGuidLiteral(narrativaAttrs.ActividadGlobalID)}' AND Vigencia=${narrativaAttrs.Vigencia} AND Periodo='${narrativaAttrs.Periodo}'`;
            }

            if (fallbackWhere) {
                let qFall = await fetchJson(`${URL_WF_SOLICITUD}/query`, {
                    f: "json",
                    where: fallbackWhere,
                    outFields: "*"
                });
                
                if (qFall && qFall.features && qFall.features.length > 0) {
                    const allowedStates = ["Borrador", "Devuelto", "Enviado", "EnVistoBuenoDirector", "EnRevisionEnlace", "EnAprobacionSubdirector", "EnRevisionOAP"];
                    const validFeatures = qFall.features.filter(f => allowedStates.includes(f.attributes.EstadoActual));
                    if (validFeatures.length > 0) {
                        return validFeatures[0].attributes;
                    }
                }
            }
        }
        return null;
    } catch (error) {
        auditError("FIND_EXISTING_WF", error, { claveUnicaSolicitud });
        return null;
    }
}

async function applyWorkflowEdits({ adds = [], updates = [] }) {
    const payload = { f: "json" };
    if (adds.length > 0) payload.adds = JSON.stringify(adds);
    if (updates.length > 0) payload.updates = JSON.stringify(updates);

    const data = await postForm(`${URL_WF_SOLICITUD}/applyEdits`, payload);

    if (data.addResults && Array.isArray(data.addResults)) {
        for (const r of data.addResults) {
            if (r.success === false) throw new Error(`Fallo insertando WF: ${r.error?.description || JSON.stringify(r.error)}`);
        }
    }
    if (data.updateResults && Array.isArray(data.updateResults)) {
        for (const r of data.updateResults) {
            if (r.success === false) throw new Error(`Fallo actualizando WF: ${r.error?.description || JSON.stringify(r.error)}`);
        }
    }
    return data;
}

async function createOrUpdateWorkflowSolicitudFromNarrativa({ narrativaAttrs, planAct, isSubmit }) {
    if (!isSubmit) return;

    if (!narrativaAttrs || !narrativaAttrs.GlobalID || !narrativaAttrs.ActividadGlobalID || !narrativaAttrs.Vigencia || !narrativaAttrs.Periodo || narrativaAttrs.EstadoRegistro !== "Enviado") {
        await auditError("WF_SOLICITUD_ERROR", "Datos críticos en narrativa inválidos o estado no es Enviado.", narrativaAttrs);
        throw new Error("Datos de narrativa incompletos o en estado incorrecto para generar workflow. Debe confirmarse en BD como 'Enviado'.");
    }

    const claveUnicaSolicitud = [
        normalizeGuidKey(narrativaAttrs.ActividadGlobalID),
        narrativaAttrs.Vigencia,
        narrativaAttrs.Periodo,
        narrativaAttrs.Version || 1
    ].join("|");

    const wfSeq = buildWorkflowSequence(planAct);

    if (planAct) {
        const reqDir = normalizeSiNo(planAct.RequiereVistoBuenoDirector);
        if (wfSeq.tipoFlujoWorkflow === "SIN_DIRECTOR" && reqDir === "SI") {
            await writeAuditEvent("WF_FLAGS_CONTRADICTORIOS", "APP_REPORTE", "ADVERTENCIA", `Flujo SIN_DIRECTOR contradice RequiereVistoBuenoDirector=SI en PLAN ${planAct.GlobalID}`);
        }
        if (wfSeq.tipoFlujoWorkflow === "ESPECIAL") {
            await writeAuditEvent("WF_FLUJO_ESPECIAL_ADVERTENCIA", "APP_REPORTE", "ADVERTENCIA", `Flujo ESPECIAL enviado sin ruta automatizada estándar. PLAN ${planAct.GlobalID}`);
        }
    }

    const existingWf = await findExistingWorkflowSolicitud(claveUnicaSolicitud, narrativaAttrs);

    const wfAttrs = {
        [F_WF.solId]: generateGUID(),
        [F_WF.tipo]: "ReporteNarrativo",
        [F_WF.objId]: narrativaAttrs.ClaveUnicaReporteActividad || claveUnicaSolicitud,
        [F_WF.objGid]: narrativaAttrs.GlobalID,
        [F_WF.actGid]: narrativaAttrs.ActividadGlobalID,
        [F_WF.planActGid]: planAct ? planAct.GlobalID : null,
        [F_WF.repNarGid]: narrativaAttrs.GlobalID,
        [F_WF.vig]: Number(narrativaAttrs.Vigencia),
        [F_WF.per]: narrativaAttrs.Periodo,
        [F_WF.persId]: currentUser?.pid || currentUser?.gid || null,
        [F_WF.fec]: Date.now(),
        [F_WF.est]: wfSeq.estadoInicial,
        [F_WF.ver]: Number(narrativaAttrs.Version || 1),
        [F_WF.comentario]: "Envío generado desde App Reporte",
        [F_WF.dep]: currentUser?.dependencia || "", 
        [F_WF.rolActual]: wfSeq.rolInicial,
        [F_WF.personaRespActual]: null,
        [F_WF.etapaActual]: wfSeq.etapaInicial,
        [F_WF.fecUltMov]: Date.now(),
        [F_WF.clave]: claveUnicaSolicitud,
        [F_WF.tipoFlujo]: wfSeq.tipoFlujoWorkflow,
        [F_WF.pasos]: wfSeq.pasosRequeridosWorkflow,
        [F_WF.pasoOrden]: wfSeq.pasoActualOrden
    };

    Object.keys(wfAttrs).forEach(k => { if (wfAttrs[k] === undefined) wfAttrs[k] = null; });

    if (!existingWf) {
        wfAttrs.GlobalID = generateGUID();
        await applyWorkflowEdits({ adds: [{ attributes: wfAttrs }] });
        await writeAuditEvent("WF_SOLICITUD_CREADA", "APP_REPORTE", "OK", `Workflow creado: ${wfAttrs.GlobalID}. Flujo: ${wfSeq.tipoFlujoWorkflow}`);

        if (wfSeq.usedFallback) {
             await writeAuditEvent("WF_FLUJO_DEFAULT_COMPLETO", "APP_REPORTE", "ADVERTENCIA", `Aplicado flujo COMPLETO por defecto para: ${wfAttrs.GlobalID}.`);
        }

        return { action: wfSeq.usedFallback ? "default_fallback" : "created", role: wfSeq.rolInicial, estado: wfSeq.estadoInicial, clave: claveUnicaSolicitud };
    } else {
        const currentEst = existingWf.EstadoActual;
        const blockStates = ["Aprobado", "AprobadoOAP", "Publicado"];

        if (blockStates.includes(currentEst) && !(wfSeq.tipoFlujoWorkflow === "PUBLICACION_DIRECTA" && currentEst === "AprobadoOAP")) {
            throw new Error("El reporte ya tiene una solicitud aprobada o publicada. No se puede reenviar desde App Reporte sin habilitar corrección controlada.");
        }

        const updateAttrs = {
            OBJECTID: existingWf.OBJECTID,
            [F_WF.est]: currentEst === "Devuelto" ? wfSeq.estadoInicial : (currentEst === "Borrador" ? wfSeq.estadoInicial : currentEst),
            [F_WF.rolActual]: currentEst === "Devuelto" || currentEst === "Borrador" ? wfSeq.rolInicial : existingWf.RolResponsableActual,
            [F_WF.etapaActual]: currentEst === "Devuelto" || currentEst === "Borrador" ? wfSeq.etapaInicial : existingWf.EtapaActual,
            [F_WF.fecUltMov]: Date.now(),
            [F_WF.tipoFlujo]: wfSeq.tipoFlujoWorkflow,
            [F_WF.pasos]: wfSeq.pasosRequeridosWorkflow,
            [F_WF.pasoOrden]: currentEst === "Devuelto" || currentEst === "Borrador" ? wfSeq.pasoActualOrden : existingWf.PasoActualOrden,
            [F_WF.repNarGid]: narrativaAttrs.GlobalID,
            [F_WF.planActGid]: planAct ? planAct.GlobalID : null,
            [F_WF.objGid]: narrativaAttrs.GlobalID,
            [F_WF.comentario]: existingWf.ComentarioSolicitante || wfAttrs[F_WF.comentario],
            [F_WF.clave]: claveUnicaSolicitud,
            [F_WF.ver]: Number(narrativaAttrs.Version || 1)
        };

        await applyWorkflowEdits({ updates: [{ attributes: updateAttrs }] });
        await writeAuditEvent("WF_SOLICITUD_ACTUALIZADA", "APP_REPORTE", "OK", `Workflow actualizado: ${existingWf.GlobalID}. Estado: ${updateAttrs[F_WF.est]}`);
        
        return { action: "updated", role: updateAttrs[F_WF.rolActual], estado: updateAttrs[F_WF.est], clave: claveUnicaSolicitud };
    }
}

// --- Autenticación OTP y Roles V4 ---
document.getElementById("btn-solicitar-codigo").addEventListener("click", async () => {
  const cedula = document.getElementById("login-cedula").value.trim(), correo = document.getElementById("login-correo").value.trim().toLowerCase();
  document.getElementById("login-msg-1").textContent = "";
  try {
    const res = await fetch(URL_WEBHOOK_POWERAUTOMATE, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({cedula, correo}) });
    if(res.status === 200 || res.status === 202) { document.getElementById("login-step-1").classList.remove("active"); document.getElementById("login-step-2").classList.add("active"); }
    else throw new Error("Credenciales inválidas o error de conexión.");
  } catch(e) { 
      document.getElementById("login-msg-1").textContent = e.message; 
      auditError("OTP_SOLICITAR", e, { correo });
  }
});

document.getElementById("btn-validar-codigo").addEventListener("click", async () => {
  const correo = document.getElementById("login-correo").value.trim().toLowerCase(), codigo = document.getElementById("login-codigo").value.trim();
  document.getElementById("login-msg-2").textContent = "Validando acceso...";
  try {
    const qOtp = await fetchJson(`${URL_OTP}/query`, { f:"json", where:`Correo='${correo}' AND CodigoHash='${codigo}' AND Usado='NO'`, outFields:"*" });
    if(!qOtp.features || !qOtp.features.length) throw new Error("Código incorrecto o expirado.");
    const otp = qOtp.features[0].attributes;
    
    const qPers = await fetchJson(`${URL_PERSONA}/query`, { f:"json", where:`GlobalID='${otp.PersonaGlobalID}' AND Activo='SI'`, outFields:"Nombre,PersonaID" });
    if(!qPers.features || !qPers.features.length) throw new Error("Usuario inactivo o no encontrado en el sistema.");
    const pid = qPers.features[0].attributes.PersonaID;

    const resR = await fetchJson(`${URL_ROL}/query`, { f: "json", where: `(PersonaID='${otp.PersonaGlobalID}' OR PersonaID='${pid}') AND Activo='SI'`, outFields: "RolID", returnGeometry: false });
    const roles = [...new Set((resR.features || []).map(f => normalizeRole(f.attributes.RolID)).filter(Boolean))];
    
    if (!hasRoleInList(roles, "EDITOR") && !hasRoleInList(roles, "SUPERADMIN")) {
        throw new Error("Acceso denegado: Su rol no le permite utilizar esta aplicación de captura operativa.");
    }

    currentUser = {
        gid: otp.PersonaGlobalID,
        pid: pid,
        nombre: qPers.features[0].attributes.Nombre,
        correo,
        roles,
        alcances: [],
        isSuperAdmin: hasRoleInList(roles, "SUPERADMIN"),
        isEditorOnly: isEditorOnlyRoleSet(roles)
    };
    
    await postForm(`${URL_OTP}/applyEdits`, { f:"json", updates: [{attributes: {OBJECTID: otp.OBJECTID, Usado: "SI"}}] });
    await writeAuditEvent("OTP_VALIDATE", "APP_REPORTE", "OK", `Ingreso exitoso a módulo operativo V4. GID: ${currentUser.gid}`);
    
    const qAlcance = await fetchJson(`${URL_ALCANCE}/query`, { f:"json", where:`(PersonaID='${currentUser.gid}' OR PersonaID='${currentUser.pid}') AND Activo='SI'`, outFields:"ObjetoGlobalID" });
    currentUser.alcances = (qAlcance.features || []).map(f => f.attributes.ObjetoGlobalID).filter(Boolean);
    currentUser.hasGlobalScope = (qAlcance.features || []).some(f => !f.attributes.ObjetoGlobalID);

    document.getElementById("login-overlay").style.display = "none";
    document.getElementById("pill-user").style.display = "block";
    document.getElementById("pill-user").textContent = `Usuario: ${currentUser.nombre}`;
    
    if (currentUser.isSuperAdmin) {
        document.getElementById("pill-superadmin").style.display = "block";
        refreshSupportPanel();
    } else {
        document.getElementById("pill-superadmin").style.display = "none";
    }
    
    await initMap(); 
    initCombosFijos(); 
    await loadAsignaciones(); 
    await loadActividades();
  } catch(e) { 
      document.getElementById("login-msg-2").textContent = e.message; 
      auditError("OTP_VALIDAR", e, { correo });
  }
});

// --- Filtros SEG_Asignacion Híbrido + SEG_Alcance V4 ---
async function loadAsignaciones() {
  if(!currentUser) return;
  if(currentUser.isSuperAdmin) { asignacionesActivas = []; return; }

  try {
      const vig = parseInt(elVigencia.value, 10);
      if (!vig || Number.isNaN(vig)) {
          asignacionesActivas = [];
          setStatus("Seleccione una vigencia válida para consultar asignaciones operativas.", "warning");
          return;
      }

      const personaWhere = buildGuidWhere("PersonaGlobalID", currentUser.gid);
      const qAsig = await fetchJson(`${URL_ASIGNACION}/query`, { 
          f: "json",
          where: `${personaWhere} AND Vigencia=${vig} AND Activo='SI'`, 
          outFields: "GlobalID,PersonaGlobalID,TipoAsignacion,ActividadGlobalID,TareaGlobalID,HeredaHijos,Activo,Vigencia",
          returnGeometry: false
      });
      
      let asigActividades = [], asigTareas = [];

      (qAsig.features || []).forEach(f => {
          const a = f.attributes || {};
          const tipo = normalizeText(a.TipoAsignacion);
          const hereda = normalizeText(a.HeredaHijos);
          const actGid = normalizeGuidLiteral(a.ActividadGlobalID);
          const tarGid = normalizeGuidLiteral(a.TareaGlobalID);

          if (tipo === "ACTIVIDAD") {
              if (hereda === "SI" && actGid) asigActividades.push(actGid);
          } else if (tipo === "TAREA") {
              if (tarGid) asigTareas.push(tarGid);
          } else {
              if (tarGid) asigTareas.push(tarGid);
              else if (actGid && hereda === "SI") asigActividades.push(actGid);
          }
      });

      asigActividades = uniqueGuidList(asigActividades);
      asigTareas = uniqueGuidList(asigTareas);
      let qJerarquiaFeatures = [];
      const collectedTaskKeys = new Set();

      if (asigActividades.length > 0) {
          let subDeActividades = [];
          for (let i = 0; i < asigActividades.length; i += 50) {
              const chunk = asigActividades.slice(i, i + 50).map(g => `'${g}'`).join(",");
              const qS = await fetchJson(`${URL_SUBACTIVIDAD}/query`, { f:"json", where:`ActividadGlobalID IN (${chunk})`, outFields:"GlobalID,ActividadGlobalID", returnGeometry:false });
              if(qS && Array.isArray(qS.features)) subDeActividades.push(...qS.features);
          }
          const subGuids = uniqueGuidList(subDeActividades.map(f => f.attributes.GlobalID));
          if (subGuids.length > 0) {
              const mapSubToAct = new Map();
              subDeActividades.forEach(s => mapSubToAct.set(normalizeGuidKey(s.attributes.GlobalID), normalizeGuidLiteral(s.attributes.ActividadGlobalID)));

              for (let i = 0; i < subGuids.length; i += 50) {
                  const chunk = subGuids.slice(i, i + 50).map(g => `'${g}'`).join(",");
                  const qT = await fetchJson(`${URL_TAREA}/query`, { f:"json", where:`SubActividadGlobalID IN (${chunk})`, outFields:"GlobalID,SubActividadGlobalID", returnGeometry:false });
                  if(qT && Array.isArray(qT.features)) {
                      qT.features.forEach(t => {
                          const tGuid = normalizeGuidLiteral(t.attributes.GlobalID);
                          const tKey = normalizeGuidKey(tGuid);
                          const sGuid = normalizeGuidLiteral(t.attributes.SubActividadGlobalID);
                          t.attributes.GlobalID = tGuid;
                          t.attributes.SubActividadGlobalID = sGuid;
                          t.attributes.ActividadGlobalID = mapSubToAct.get(normalizeGuidKey(sGuid));
                          t.attributes.OrigenConsolidado = "ACTIVIDAD";
                          if (!collectedTaskKeys.has(tKey)) {
                              qJerarquiaFeatures.push(t);
                              collectedTaskKeys.add(tKey);
                          }
                      });
                  }
              }
          }
      }

      if (asigTareas.length > 0) {
          let tareasPuntuales = [];
          for (let i = 0; i < asigTareas.length; i += 50) {
              const chunk = asigTareas.slice(i, i + 50).map(g => `'${g}'`).join(",");
              const qT = await fetchJson(`${URL_TAREA}/query`, { f:"json", where:`GlobalID IN (${chunk})`, outFields:"GlobalID,SubActividadGlobalID", returnGeometry:false });
              if(qT && Array.isArray(qT.features)) tareasPuntuales.push(...qT.features);
          }
          const validSubIds = uniqueGuidList(tareasPuntuales.map(t => t.attributes.SubActividadGlobalID).filter(Boolean));
          const subMap = new Map();
          if (validSubIds.length > 0) {
              for (let i = 0; i < validSubIds.length; i += 50) {
                  const chunk = validSubIds.slice(i, i + 50).map(g => `'${g}'`).join(",");
                  const qS = await fetchJson(`${URL_SUBACTIVIDAD}/query`, { f:"json", where:`GlobalID IN (${chunk})`, outFields:"GlobalID,ActividadGlobalID", returnGeometry:false });
                  if(qS && Array.isArray(qS.features)) {
                      qS.features.forEach(f => subMap.set(normalizeGuidKey(f.attributes.GlobalID), normalizeGuidLiteral(f.attributes.ActividadGlobalID)));
                  }
              }
          }
          tareasPuntuales.forEach(t => {
              const tGuid = normalizeGuidLiteral(t.attributes.GlobalID);
              const tKey = normalizeGuidKey(tGuid);
              const sGuid = normalizeGuidLiteral(t.attributes.SubActividadGlobalID);
              t.attributes.GlobalID = tGuid;
              t.attributes.SubActividadGlobalID = sGuid;
              t.attributes.ActividadGlobalID = subMap.get(normalizeGuidKey(sGuid));
              if (!collectedTaskKeys.has(tKey)) {
                  t.attributes.OrigenConsolidado = "TAREA";
                  qJerarquiaFeatures.push(t);
                  collectedTaskKeys.add(tKey);
              }
          });
      }

      asignacionesActivas = qJerarquiaFeatures.map(f => ({
          TareaGlobalID: normalizeGuidLiteral(f.attributes.GlobalID),
          SubActividadGlobalID: normalizeGuidLiteral(f.attributes.SubActividadGlobalID),
          ActividadGlobalID: normalizeGuidLiteral(f.attributes.ActividadGlobalID),
          TipoOrigenAsignacion: f.attributes.OrigenConsolidado || "TAREA"
      })).filter(a => a.TareaGlobalID && a.ActividadGlobalID);

      if (!asignacionesActivas.length) {
          setStatus(`No tiene tareas asignadas activas para la vigencia ${vig}.`, "info");
      }
  } catch (e) {
      auditError("LOAD_ASIGNACIONES", e, { vigencia: elVigencia.value });
      setStatus("Error al consultar asignaciones operativas en la plataforma.", "error");
  }
}

async function loadActividades() {
  if(!currentUser) return;
  try {
      const vig = elVigencia.value;
      let data = [];
      cacheActividadesPesos.clear();

      if (currentUser.isSuperAdmin) {
          const qAct = await fetchJson(`${URL_ACTIVIDAD}/query`, { f:"json", where:`Activo='SI' AND Vigencia=${vig}`, outFields:"GlobalID,ActividadID,NombreActividad,Peso", orderByFields:"ActividadID ASC" });
          if(qAct && Array.isArray(qAct.features) && qAct.features.length > 0) {
              qAct.features.forEach(f => cacheActividadesPesos.set(normalizeGuidKey(f.attributes.GlobalID), f.attributes.Peso || 0));
              data = qAct.features.map(f => ({ value: f.attributes.GlobalID, label: `${f.attributes.ActividadID} - ${f.attributes.NombreActividad}` }));
          }
      } else {
          const actGuids = [...new Set(asignacionesActivas.map(a => a.ActividadGlobalID).filter(Boolean))];
          if(actGuids.length > 0) { 
              let qActFeatures = [];
              for (let i = 0; i < actGuids.length; i += 50) {
                  const chunk = actGuids.slice(i, i + 50).map(g => `'${g}'`).join(",");
                  const qA = await fetchJson(`${URL_ACTIVIDAD}/query`, { f:"json", where:`GlobalID IN (${chunk}) AND Activo='SI' AND Vigencia=${vig}`, outFields:"GlobalID,ActividadID,NombreActividad,Peso", orderByFields:"ActividadID ASC" });
                  if(qA && Array.isArray(qA.features)) qActFeatures.push(...qA.features);
              }
              qActFeatures.forEach(f => cacheActividadesPesos.set(normalizeGuidKey(f.attributes.GlobalID), f.attributes.Peso || 0));
              data = qActFeatures.map(f => ({ value: f.attributes.GlobalID, label: `${f.attributes.ActividadID} - ${f.attributes.NombreActividad}` }));
          }
      }

      renderCombo("combo-actividad", data, data.length ? "— Selecciona o busca —" : `Sin actividades operativas en ${vig}`, async (val) => {
          if(!val) { elIndicadores.innerHTML = ""; actContextPanel.style.display = "none"; document.getElementById("lbl-responsable").textContent = "Responsable: —"; refreshSupportPanel(); return; }
          document.getElementById("lbl-responsable").textContent = `Responsable: ${currentUser.nombre}`;
          await loadSubactividadesYTareas(val);
          refreshSupportPanel();
      });
      
      if(!data.length) elIndicadores.innerHTML = ""; 
  } catch (e) {
      auditError("LOAD_ACTIVIDADES", e, { vigencia: elVigencia.value });
      setStatus("Ocurrió un error al cargar el catálogo de actividades.", "error");
  }
}

async function loadSubactividadesYTareas(actividadGlobalId) {
  elIndicadores.innerHTML = ""; cacheSubactividades = []; cacheTareas = [];
  rowLocations.clear(); existingAvances.clear(); existingWFSolicitudes.clear(); deletedLocations = []; existingNarrativa = null;
  planActCtx = null; biActCtx = null; planSubCtx.clear(); biSubCtx.clear(); planTarCtx.clear(); biTarCtx.clear();
  viewOnlyMode = false;
  setStatus("Cargando estructura, contexto de planeación y reportes...");

  try {
      const vig = elVigencia.value;
      const pesoActRaw = cacheActividadesPesos.get(normalizeGuidKey(actividadGlobalId));
      const pesoActDisplay = pesoActRaw !== undefined ? `${pesoActRaw}%` : "N/D";

      const subQ = await fetchJson(`${URL_SUBACTIVIDAD}/query`, { f:"json", where:`ActividadGlobalID='${actividadGlobalId}'`, outFields:"*" });
      cacheSubactividades = (subQ && Array.isArray(subQ.features) ? subQ.features : []).map(f=>f.attributes);
      
      const tareasAsignadasKeys = new Set(
        asignacionesActivas
          .filter(a => normalizeGuidKey(a.ActividadGlobalID) === normalizeGuidKey(actividadGlobalId))
          .map(a => normalizeGuidKey(a.TareaGlobalID))
      );
      const inListSub = cacheSubactividades.map(s => `'${s.GlobalID}'`).join(",");
      
      if(inListSub) {
        const tareaQ = await fetchJson(`${URL_TAREA}/query`, { f:"json", where:`SubActividadGlobalID IN (${inListSub})`, outFields:"*" });
        let allTasks = (tareaQ && Array.isArray(tareaQ.features) ? tareaQ.features : []).map(f=>f.attributes);
        if (!currentUser.isSuperAdmin) allTasks = allTasks.filter(t => tareasAsignadasKeys.has(normalizeGuidKey(t.GlobalID)));
        cacheTareas = allTasks;
      }

      // --- BLOQUE 1: CARGA DE PLAN (INDEPENDIENTE) ---
      try {
          diagSubsVis = cacheSubactividades.length;
          diagSubsLoad = 0; diagSubsMatch = 0;
          diagTarsVis = cacheTareas.length;
          diagTarsLoad = 0; diagTarsMatch = 0;

          const visibleSubKeys = new Set(cacheSubactividades.map(s => normalizeGuidKey(s.GlobalID)));
          const visibleTarKeys = new Set(cacheTareas.map(t => normalizeGuidKey(t.GlobalID)));

          const qPlanAct = await fetchJson(`${URL_PLAN_ACT}/query`, { f:"json", where:`ActividadGlobalID='${actividadGlobalId}' AND Vigencia=${vig}`, outFields:"*" });
          if(qPlanAct && Array.isArray(qPlanAct.features) && qPlanAct.features.length) planActCtx = qPlanAct.features[0].attributes;
          
          const planSubFeatures = await fetchAllByWhere(URL_PLAN_SUB, `Vigencia=${vig}`);
          diagSubsLoad = planSubFeatures.length;
          planSubFeatures.forEach(f => {
              const subKey = normalizeGuidKey(f.attributes.SubActividadGlobalID);
              if (visibleSubKeys.has(subKey)) {
                  planSubCtx.set(subKey, f.attributes);
                  diagSubsMatch++;
              }
          });

          const planTarFeatures = await fetchAllByWhere(URL_PLAN_TAR, `Vigencia=${vig}`);
          diagTarsLoad = planTarFeatures.length;
          planTarFeatures.forEach(f => {
              const tarKey = normalizeGuidKey(f.attributes.TareaGlobalID);
              if (visibleTarKeys.has(tarKey)) {
                  planTarCtx.set(tarKey, f.attributes);
                  diagTarsMatch++;
              }
          });
      } catch (e) { 
          console.warn("Contexto PLAN incompleto o no disponible.", e); 
          auditError("LOAD_CONTEXTO_PLAN", e, { actividadGlobalId });
      }

      // --- BLOQUE 2: CARGA DE BI ---
      try {
          const qBiAct = await fetchJson(`${URL_BI_ACT}/query`, { f:"json", where:`GlobalID_Nivel='${actividadGlobalId}' AND Vigencia=${vig}`, outFields:"*" });
          if(qBiAct && Array.isArray(qBiAct.features) && qBiAct.features.length) biActCtx = qBiAct.features[0].attributes;

          if(inListSub) {
              const qBiSub = await fetchJson(`${URL_BI_SUB}/query`, { f:"json", where:`SubActividadGlobalID IN (${inListSub}) AND Vigencia=${vig}`, outFields:"*" });
              if(qBiSub && Array.isArray(qBiSub.features) && qBiSub.features.length) {
                  qBiSub.features.forEach(f => biSubCtx.set(f.attributes.SubActividadGlobalID, f.attributes));
              }
          }

          const inListTar = cacheTareas.map(t => `'${t.GlobalID}'`).join(",");
          if(inListTar) {
              const qBiTar = await fetchJson(`${URL_BI_TAR}/query`, { f:"json", where:`TareaGlobalID IN (${inListTar}) AND Vigencia=${vig}`, outFields:"*" });
              if(qBiTar && Array.isArray(qBiTar.features) && qBiTar.features.length) {
                  qBiTar.features.forEach(f => biTarCtx.set(f.attributes.TareaGlobalID, f.attributes));
              }
          }
      } catch (e) {
          console.warn("Contexto BI incompleto o no disponible.", e); 
          auditError("LOAD_CONTEXTO_BI", e, { actividadGlobalId });
      }

      // --- INJERTO 1: PESO ACTIVIDAD ---
      if (planActCtx) {
          actContextPanel.style.display = "block";
          const aplicaAct = String(planActCtx.Aplica || "SI").toUpperCase() !== "NO";
          actContextPanel.innerHTML = `
              <div style="margin-bottom: 8px;"><strong>Contexto de Planeación (${vig})</strong> ${!aplicaAct ? '<span class="status-badge status-badge--devuelto" style="margin-left:10px;">NO APLICA EN LA VIGENCIA</span>' : ''}</div>
              <div style="display:flex; gap: 10px; flex-wrap: wrap;">
                  <span class="ctx-badge ctx-badge--tech">Peso Act: ${pesoActDisplay}</span>
                  <span class="ctx-badge">Indicador: ${planActCtx.IndicadorID ?? 'N/A'}</span>
                  <span class="ctx-badge">Línea Base: ${planActCtx.LineaBase ?? 'N/A'}</span>
                  <span class="ctx-badge">Meta Prog.: ${planActCtx.MetaProgramada ?? 'N/A'}</span>
                  <span class="ctx-badge">Unidad: ${planActCtx.UnidadMedida ?? 'N/A'}</span>
                  <span class="ctx-badge" style="background:#dcfce7; color:#166534;">Avance Acum. Calculado: ${biActCtx?.AvanceAcumulado ?? 0}%</span>
              </div>
          `;
      } else actContextPanel.style.display = "none"; 

      syncReporteConsolidadoUI();

      elIndicadores.innerHTML = cacheSubactividades.map(sa => subActividadCardHtml(sa)).join("");
      if (elSubactNav) elSubactNav.style.display = cacheSubactividades.length ? "flex" : "none";
      
      populateTopSubactSelector();

      document.querySelectorAll(".row.is-not-applicable").forEach(rowEl => {
          showRowMessage(rowEl.getAttribute("data-row-id"), "Esta tarea no aplica para la vigencia actual.", "info");
      });

      try {
          const res = await loadExistingData(actividadGlobalId); 
          const histCtx = evaluateHistoricalSelection(elVigencia.value, getPeriodo());
          
          if (res && res.status === "empty") {
              clearMapGraphics();
              document.querySelectorAll(".row").forEach(rowEl => {
                  const valInput = rowEl.querySelector(".row-valor");
                  if(valInput) valInput.value = "";
                  const obsInput = rowEl.querySelector(".row-obs");
                  if(obsInput) obsInput.value = "";
                  const eviInput = rowEl.querySelector(".row-evi");
                  if(eviInput) eviInput.value = "";
              });
              ["txt-reporte-narrativo", "txt-logros-descripcion", "txt-logros-principales"].forEach(id => { 
                 const el = document.getElementById(id); if (el) { el.value = ""; el.disabled = false; } 
              });
              clearReporteConsolidadoFields(false);
              syncReporteConsolidadoUI();
              setConsolidatedFieldsDisabled(false);
              document.getElementById("narrativa-badge-container").innerHTML = "";
              document.getElementById("container-motivo-narrativa").style.display = "none";
              
              if (histCtx.isFuture) {
                  evaluateHistoricalMode(true);
                  setStatus("La vigencia seleccionada no está habilitada para reporte.", "error");
              } else if (histCtx.isPastVigencia) {
                  evaluateHistoricalMode(true);
                  setStatus("No existen reportes previos para la combinación seleccionada.", "info");
              } else {
                  evaluateHistoricalMode(false);
                  setStatus("No existen reportes previos para esta actividad y periodo. (Primer Cargue)", "info");
              }
          } else {
              if (histCtx.isFuture) {
                  evaluateHistoricalMode(true);
                  setStatus("La vigencia seleccionada no está habilitada para reporte.", "error");
              } else if (histCtx.isPastVigencia || histCtx.isPastQuarter) {
                  evaluateHistoricalMode(histCtx.isPastVigencia); 
                  setStatus(`Está visualizando un trimestre ya reportado: ${histCtx.p} ${histCtx.v}. Verifique si desea continuar o cambie a ${OPERATIVE_PERIODO} ${OPERATIVE_VIGENCIA}.`, "warning");
              } else {
                  evaluateHistoricalMode(false);
                  setStatus("Formulario operativo cargado.", "success");
              }
          }
      } catch (err) {
          console.warn("Error técnico al cargar históricos:", err);
          auditError("LOAD_EXISTING_DATA", err, { actividadGlobalId });
          evaluateHistoricalMode(false);
          setStatus("Error técnico al recuperar datos históricos. Comuníquese con soporte.", "error");
      }
  } catch (e) {
      auditError("LOAD_ESTRUCTURA_TAREAS", e, { actividadGlobalId });
      setStatus("Error grave al cargar la configuración de tareas. Comuníquese con soporte.", "error");
  }
}

// --- Event Delegation para Activación y Click de Tareas ---
elIndicadores.addEventListener("click", (e) => {
    const btnActivar = e.target.closest(".btn-activar");
    if (btnActivar) {
        const rowEl = btnActivar.closest(".row");
        if (rowEl) activateTaskRow(rowEl);
    }
});

function activateTaskRow(rowEl) {
    const rowId = rowEl.getAttribute("data-row-id");
    if (isTaskReadonly(rowId)) return setStatus("Esta tarea está bloqueada o no aplica.", "error");
    document.querySelectorAll(".row").forEach(r => r.classList.remove("row--active"));
    rowEl.classList.add("row--active");
    activeRowId = rowId;
    const codTarea = rowEl.querySelector("label").textContent.replace("Tarea ", "").trim();
    const nomTarea = rowEl.querySelector(".mono").textContent.trim();
    document.getElementById("pill-active").textContent = `Tarea activa para georreferenciar: ${codTarea} - ${nomTarea.substring(0, 20)}...`;
    
    const cardEl = rowEl.closest('.card');
    if (cardEl && cardEl.classList.contains('collapsed')) cardEl.classList.remove('collapsed');
    
    rowEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setStatus("Tarea seleccionada para ubicar puntos en el mapa.", "success");
    
    openMapDrawer();
}

// --- Render y Estados V4 ---
function tareaRowHtml(t){
  const rowId = crypto.randomUUID(), gid = t.GlobalID, cod = t.CodigoTarea, nom = t.NombreTarea, geo = toYesNo(t.EsGeorreferenciable);
  rowLocations.set(rowId, []);
  
  const pTar = planTarCtx.get(normalizeGuidKey(gid));
  const aplica = !(pTar && String(pTar.Aplica).toUpperCase() === 'NO');
  const classNotApp = !aplica ? 'is-not-applicable is-readonly' : '';
  const bTar = biTarCtx.get(gid);

  const peso = pTar && pTar.PesoTarea != null ? `${pTar.PesoTarea}%` : "N/D";
  const meta = pTar && pTar.MetaProgramada != null ? pTar.MetaProgramada : null;

  return `
  <div class="row ${classNotApp}" data-row-id="${rowId}" data-tarea-gid="${gid}" data-geo="${geo?"1":"0"}">
    <div class="row__left">
      <div class="field" style="padding:0; grid-column: 1 / span 2;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <label style="margin-bottom:0;">Tarea ${cod}</label>
          <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
            <span class="ctx-badge ctx-badge--tech" style="margin:0;">Peso Tarea: ${peso}</span>
            ${meta !== null ? `<span class="ctx-badge ctx-badge--tech" style="margin:0;">Meta: ${meta}</span>` : ''}
          </div>
        </div>
        <div class="mono" style="font-size:12px; margin-bottom:6px; margin-top:4px;">${nom}</div>
        <div id="badge-container-${rowId}">
           ${!aplica ? '<span class="status-badge status-badge--devuelto" style="background:#fee2e2;color:#991b1b;">NO APLICA</span>' : ''}
        </div>
        ${aplica && bTar ? `<div style="font-size:11px; margin-top:4px; color:var(--primary-2);"><b>Acumulado:</b> ${bTar.AvanceAcumulado??0}%</div>` : ''}
      </div>
      <div id="msg-container-${rowId}" class="row__messages"></div>
      <div class="field field-motivo" id="container-motivo-${rowId}" style="display:none; grid-column: 1 / span 2;">
        <label style="color:var(--danger);">Motivo de ajuste (Devuelto)</label>
        <input type="text" class="row-motivo" placeholder="Indica qué corregiste..." ${!aplica ? 'disabled' : ''} />
      </div>
      <div class="field" style="padding:0;"><label>Valor reportado</label><input class="row-valor" type="number" step="any" ${!aplica ? 'disabled' : ''} /></div>
      <div class="field" style="padding:0; grid-column: 1 / span 2;"><label>Observaciones</label><input class="row-obs" type="text" ${!aplica ? 'disabled' : ''} /></div>
      <div class="field" style="padding:0; grid-column: 1 / span 2;"><label>Evidencia (URL)</label><input class="row-obs row-evi" type="url" ${!aplica ? 'disabled' : ''} /></div>
      ${geo ? `<div class="loc-list" id="loc-list-${rowId}" style="grid-column: 1 / span 2;"></div>` : ``}
    </div>
    <div class="row__right">
      ${geo ? `<button type="button" class="btn btn--primary btn-activar" ${!aplica ? 'style="display:none;"' : ''}>Seleccionar para ubicar puntos</button>` : ``}
      <button class="btn btn--danger btn-eliminar" style="display:none;">Eliminar Fila (Local)</button>
    </div>
  </div>`;
}

function subActividadCardHtml(sa){
  const rows = cacheTareas.filter(t => t.SubActividadGlobalID === sa.GlobalID);
  if(!rows.length) return "";
  const pSub = planSubCtx.get(normalizeGuidKey(sa.GlobalID));
  const aplicaSub = !(pSub && String(pSub.Aplica).toUpperCase() === 'NO');

  const bSub = biSubCtx.get(sa.GlobalID);
  let biHtml = "";
  if (aplicaSub && bSub) {
      const av = bSub.AvanceAcumulado ?? bSub.AvanceAcumuladoVigencia ?? 0;
      biHtml += `<span class="ctx-badge" style="background:#dcfce7; color:#166534; font-size:11px; margin:0;">Avance Acum: ${av}%</span>`;
      if (bSub.EstadoFlujo) biHtml += `<span class="ctx-badge" style="background:#e0f2fe; color:#1e40af; font-size:11px; margin:0;">Estado: ${bSub.EstadoFlujo}</span>`;
      if (bSub.SemaforoGestion) biHtml += `<span class="ctx-badge" style="background:#fef9c3; color:#854d0e; font-size:11px; margin:0;">Semáforo: ${bSub.SemaforoGestion}</span>`;
  }

  const peso = pSub && pSub.PesoSubActividad != null ? `${pSub.PesoSubActividad}%` : "N/D";
  const meta = pSub && pSub.MetaProgramada != null ? pSub.MetaProgramada : null;
  
  const isCollapsed = !aplicaSub ? 'collapsed' : '';
  
  return `<div class="card ${!aplicaSub ? 'is-not-applicable' : ''} ${isCollapsed}">
            <div class="card__top accordion-header" style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;" onclick="toggleAccordion(this.closest('.card'))">
                <div style="display:flex; align-items:center; margin-right:auto;">
                    <span class="accordion-icon">▼</span>
                    <p class="card__title" style="margin:0;">${sa.CodigoSubActividad} - ${sa.NombreSubActividad}</p>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                    <span class="ctx-badge ctx-badge--tech" style="margin:0;">Peso Sub: ${peso}</span>
                    ${meta !== null ? `<span class="ctx-badge ctx-badge--tech" style="margin:0;">Meta Sub: ${meta}</span>` : ''}
                    ${!aplicaSub ? '<span class="ctx-badge" style="background:#fee2e2; color:#991b1b; font-size:11px; margin:0;">SUBACTIVIDAD NO APLICA</span>' : ''}
                    ${biHtml}
                </div>
            </div>
            <div class="rows accordion-body">${rows.map(tareaRowHtml).join("")}</div>
          </div>`;
}

// --- LECTURA BIDIRECCIONAL V4 ---
async function loadExistingData(actGid) {
  const vig = elVigencia.value, per = getPeriodo();
  const avGuids = [];

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
  
  indicatorPriorAccumulated = await fetchIndicadorPriorAccumulated(actGid, vig, per);

  const qNar = await fetchJson(`${URL_NARRATIVA}/query`, { f:"json", where:`ActividadGlobalID='${actGid}' AND Vigencia=${vig} AND Periodo='${per}'`, outFields:"*" });
  
  if(qNar && Array.isArray(qNar.features) && qNar.features.length) {
    existingNarrativa = qNar.features[0].attributes;
    existingNarrativa.EstadoRegistro = normalizeState(existingNarrativa.EstadoRegistro);
    document.getElementById("txt-reporte-narrativo").value = existingNarrativa.TextoNarrativo || "";
    document.getElementById("txt-logros-descripcion").value = existingNarrativa.DescripcionLogrosAlcanzados || "";
    document.getElementById("txt-logros-principales").value = existingNarrativa.PrincipalesLogros || "";
    populateReporteConsolidadoFromExisting(existingNarrativa);
    applyReadonlyStateNarrativa(existingNarrativa.EstadoRegistro);
  } else {
    clearReporteConsolidadoFields(true);
  }

  syncReporteConsolidadoUI();

  let allAvancesFeatures = [];
  if(cacheTareas.length > 0) {
      const chunkSize = 15; 
      for (let i = 0; i < cacheTareas.length; i += chunkSize) {
          const chunk = cacheTareas.slice(i, i + chunkSize).map(t => `'${t.GlobalID}'`).join(",");
          const qAv = await fetchJson(`${URL_AVANCE_TAREA}/query`, { f:"json", where:`TareaGlobalID IN (${chunk}) AND Vigencia=${vig} AND Periodo='${per}'`, outFields:"*" });
          if (qAv && Array.isArray(qAv.features)) allAvancesFeatures.push(...qAv.features);
      }

      allAvancesFeatures.forEach(f => {
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

  if(avGuids.length > 0) {
      const chunkSize = 15;
      for (let i = 0; i < avGuids.length; i += chunkSize) {
          const chunk = avGuids.slice(i, i + chunkSize).join(",");
          const qUb = await fetchJson(`${URL_TAREA_UBICACION}/query`, { f:"json", where:`AvanceTareaGlobalID IN (${chunk})`, outFields:"*", returnGeometry:true, outSR:"4326" });
          if(qUb && Array.isArray(qUb.features)) {
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
      }
  }

  if(avGuids.length === 0 && !existingNarrativa) {
      return { status: "empty" };
  }
  return { status: "ok" };
}

function applyReadonlyStateTask(rowEl, estado) {
  const rowId = rowEl.getAttribute("data-row-id");
  const badgeHtml = `<span class="status-badge status-badge--${estado.toLowerCase()}">${estado}</span>`;
  const container = rowEl.querySelector(`[id^="badge-container-"]`);
  if (!container.innerHTML.includes("NO APLICA")) container.innerHTML = badgeHtml;
  else container.innerHTML += badgeHtml;

  if(estado === "Devuelto" && !rowEl.classList.contains("is-not-applicable")) {
      rowEl.querySelector(".field-motivo").style.display = "block";
      showRowMessage(rowId, "Tarea devuelta: requiere corrección y motivo de ajuste.", "error");
  }

  const isReadonly = ["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(estado);
  if(isReadonly) {
    showRowMessage(rowId, `Lectura bloqueada: Estado ${estado}.`, "warning");
    rowEl.classList.add("is-readonly");
    rowEl.querySelectorAll("input").forEach(i => i.disabled = true);
    const btnAct = rowEl.querySelector(".btn-activar"); if(btnAct) btnAct.style.display = "none";
    rowEl.querySelectorAll(".btn-loc-del").forEach(b => b.style.display = "none");
    rowEl.querySelectorAll(".loc-item__actions").forEach(a => a.style.display = "none");
  }
}

function applyReadonlyStateNarrativa(estado) {
  const isReadonly = ["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(estado);
  if (isReadonly) {
      showNarrativeMessage(`Sección bloqueada: El reporte está en estado ${estado}.`, "warning");
  } else if (estado === "Devuelto") {
      showNarrativeMessage("Narrativa devuelta: Ajuste el texto según las observaciones del revisor.", "error");
  }

  document.getElementById("narrativa-badge-container").innerHTML = `<span class="status-badge status-badge--${estado.toLowerCase()}">${estado}</span>`;
  if(estado === "Devuelto") document.getElementById("container-motivo-narrativa").style.display = "block";
  ["txt-reporte-narrativo", "txt-logros-descripcion", "txt-logros-principales", "txt-motivo-narrativa", "txt-valor-indicador", "txt-observacion-indicador", "txt-evidencia-indicador", "txt-avance-ods", "txt-avance-rezago", "txt-avance-reserva"].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = isReadonly; });
}

function evaluateHistoricalMode(forceReadOnly = false) {
    let allLocked = true;
    let hasData = false;

    document.querySelectorAll(".row").forEach(rowEl => {
        if (!rowEl.classList.contains("is-not-applicable")) {
            hasData = true;
            if (!rowEl.classList.contains("is-readonly")) allLocked = false;
        }
    });

    if (existingNarrativa) {
        hasData = true;
        if (!["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(existingNarrativa.EstadoRegistro)) allLocked = false;
    }
    
    const histCtx = evaluateHistoricalSelection(elVigencia.value, getPeriodo());
    if (histCtx.isPastVigencia || histCtx.isFuture || forceReadOnly) {
        allLocked = true;
    }

    if ((hasData && allLocked) || forceReadOnly || histCtx.isPastVigencia || histCtx.isFuture) {
        viewOnlyMode = true;
        elModo.style.display = "flex";
        elModo.textContent = "Modo: Histórico (Solo Lectura)";
        elModo.style.background = "#fef2f2";
        elModo.style.color = "#991b1b";
        btnGuardar.style.display = "none";
        btnEnviar.style.display = "none";
        
        document.querySelectorAll(".row").forEach(rowEl => {
             if (!rowEl.classList.contains("is-not-applicable")) {
                 rowEl.classList.add("is-readonly");
                 rowEl.querySelectorAll("input").forEach(i => i.disabled = true);
                 const btnAct = rowEl.querySelector(".btn-activar"); if(btnAct) btnAct.style.display = "none";
                 rowEl.querySelectorAll(".btn-loc-del").forEach(b => b.style.display = "none");
                 rowEl.querySelectorAll(".loc-item__actions").forEach(a => a.style.display = "none");
             }
        });
        ["txt-reporte-narrativo", "txt-logros-descripcion", "txt-logros-principales", "txt-motivo-narrativa", "txt-valor-indicador", "txt-observacion-indicador", "txt-evidencia-indicador", "txt-avance-ods", "txt-avance-rezago", "txt-avance-reserva"].forEach(id => { 
             const el = document.getElementById(id); if(el) el.disabled = true; 
        });
    } else {
        viewOnlyMode = false;
        elModo.style.display = "flex";
        elModo.textContent = "Modo: Edición";
        elModo.style.background = "#eff6ff";
        elModo.style.color = "#1d4ed8";
        btnGuardar.style.display = "inline-flex";
        btnEnviar.style.display = "inline-flex";
        setConsolidatedFieldsDisabled(false);
    }
}

function deleteLocation(rowId, ptId) {
  if (isTaskReadonly(rowId)) return setStatus("Tarea bloqueada. No se pueden eliminar ubicaciones.", "error");
  
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
  const isError = mun === "Fuera de CAR" ? 'style="color: #d64545;"' : '';
  const readonly = isTaskReadonly(rowId);

  div.innerHTML = `
    <div class="loc-item__header" ${isError}>
        <span>📍 Sitio: <span class="loc-coords">${lat.toFixed(5)}, ${lon.toFixed(5)}</span></span>
    </div>
    <div class="field" style="padding:0;"><input class="loc-desc" type="text" value="${escapeHtml(desc)}" placeholder="Descripción del sitio..." ${readonly?'disabled':''} /></div>
    <div class="loc-item__grid">
      <div class="field" style="padding:0;"><input class="loc-mun" type="text" value="${escapeHtml(mun)}" readonly ${readonly?'disabled':''} /></div>
      <div class="field" style="padding:0;"><input class="loc-dane" type="text" value="${escapeHtml(dane)}" readonly ${readonly?'disabled':''} /></div>
    </div>
    <div class="loc-item__actions" ${readonly?'style="display:none;"':''}>
        <button type="button" class="btn-loc-del">Eliminar</button>
    </div>`;
  
  div.querySelector(".btn-loc-del").addEventListener("click", () => deleteLocation(rowId, ptId));
  
  if (mun === "Fuera de CAR") div.querySelector(".loc-item__header").style.borderBottom = "1px solid red";
  listEl.appendChild(div);
}

// --- MAPA V4 ---
function initMap(){
  return new Promise((resolve, reject) => {
    require([ "esri/Map", "esri/views/MapView", "esri/layers/GraphicsLayer", "esri/layers/FeatureLayer", "esri/Graphic", "esri/widgets/Sketch/SketchViewModel", "esri/geometry/support/webMercatorUtils", "esri/widgets/Search", "esri/widgets/BasemapGallery", "esri/widgets/Expand"
    ], (Map, MapView, GraphicsLayer, FeatureLayer, Graphic, SketchViewModel, _webMercatorUtils, Search, BasemapGallery, Expand) => {
      try {
          webMercatorUtils = _webMercatorUtils; map = new Map({ basemap: "osm" });
          const jurisdiccionLayer = new FeatureLayer({ url: `${CAR_SERVICE_URL}/${CAR_JUR_LAYER_ID}`, title: "Municipios CAR", opacity: 0.15, outFields: ["*"] });
          map.add(jurisdiccionLayer); graphicsLayer = new GraphicsLayer({ title: "Puntos" }); map.add(graphicsLayer);
          view = new MapView({ container: "map", map, center: [-74.2, 4.7], zoom: 8, popup: { dockEnabled: true, dockOptions: { position: "top-right", breakpoint: false } } });
          view.ui.add(new Search({ view: view }), "top-right");
          view.ui.add(new Expand({ view: view, content: new BasemapGallery({ view: view, container: document.createElement("div") }), expandIcon: "basemap" }), "top-left");
          
          view.whenLayerView(jurisdiccionLayer).then((layerView) => { jurisdiccionLayerView = layerView; });
          view.when(() => view.resize()); 
          
          sketchVM = new SketchViewModel({ view, layer: graphicsLayer, updateOnGraphicClick: false });

          sketchVM.on("update", async (evt) => {
            if(evt.state !== "complete") return;
            const g = evt.graphics?.[0]; if(!g || !g.attributes?.rowId || !g.attributes?.ptId) return;
            if(isTaskReadonly(g.attributes.rowId)) return setStatus("Edición de punto denegada. Tarea bloqueada.", "error");

            const geo = getGeographicLocation(g.geometry); const rId = g.attributes.rowId; const pId = g.attributes.ptId;
            const locs = rowLocations.get(rId) || []; const locObj = locs.find(l => l.ptId === pId);
            if(locObj){ locObj.lon = geo.longitude; locObj.lat = geo.latitude; const el = document.getElementById(`loc-${pId}`); if(el) el.querySelector('.loc-coords').textContent = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`; }
            await updateMunicipioFromCAR(rId, pId, g.geometry);
          });

          view.on("click", async (evt) => {
            if(!activeRowId) return setStatus("Activa un registro en el panel para georreferenciar.", "error"); 
            if (isTaskReadonly(activeRowId)) return setStatus("La tarea activa está bloqueada. No puedes añadir puntos.", "error");

            const geo = getGeographicLocation(evt.mapPoint); const ptId = crypto.randomUUID(); const locs = rowLocations.get(activeRowId) || [];
            locs.push({ ptId, lon: geo.longitude, lat: geo.latitude, mun: "", dane: "", desc: "" }); rowLocations.set(activeRowId, locs);
            addGraphicForPoint(activeRowId, ptId, geo.longitude, geo.latitude, Graphic);
            appendLocationUI(activeRowId, ptId, geo.longitude, geo.latitude);
            await updateMunicipioFromCAR(activeRowId, ptId, evt.mapPoint);
          });
          resolve(true);
      } catch (e) {
          auditError("INIT_MAP", e);
          setStatus("Error crítico al inicializar el visor geográfico.", "error");
          reject(e);
      }
    });
  });
}

function clearMapGraphics(){ if(graphicsLayer) graphicsLayer.removeAll(); }
function removeGraphicForPoint(ptId){ if(graphicsLayer) graphicsLayer.graphics.filter(g => g?.attributes?.ptId === ptId).forEach(g => graphicsLayer.remove(g)); }
function removeAllGraphicsForRow(rowId){ if(graphicsLayer) graphicsLayer.graphics.filter(g => g?.attributes?.rowId === rowId).forEach(g => graphicsLayer.remove(g)); }
function addGraphicForPoint(rowId, ptId, lon, lat, Graphic){ removeGraphicForPoint(ptId); const graphic = new Graphic({ geometry: { type: "point", longitude: lon, latitude: lat, spatialReference: { wkid: 4326 } }, symbol: { type: "simple-marker", style: "circle", color: [23,151,209,0.9], size: 10, outline: { color: [11,82,105,1], width: 2 } }, attributes: { rowId, ptId } }); graphicsLayer.add(graphic); return graphic; }
function getGeographicLocation(p) { return (p.spatialReference && p.spatialReference.isWebMercator && webMercatorUtils) ? webMercatorUtils.webMercatorToGeographic(p) : p; }

async function updateMunicipioFromCAR(rowId, ptId, mapPoint){
  if (!jurisdiccionLayerView || isTaskReadonly(rowId)) return;
  try{
    document.body.style.cursor = 'wait';
    const result = await jurisdiccionLayerView.queryFeatures({ geometry: mapPoint, spatialRelationship: "intersects", returnGeometry: false, outFields: ["*"] });
    const locEl = document.getElementById(`loc-${ptId}`); if(!locEl) return;
    const munEl = locEl.querySelector(".loc-mun"); const daneEl = locEl.querySelector(".loc-dane");
    
    if(!result.features.length){
      if(munEl) munEl.value = "Fuera de CAR"; if(daneEl) daneEl.value = "N/A";
      locEl.querySelector(".loc-item__header").style.borderBottom = "1px solid red";
      locEl.querySelector(".loc-item__header").style.color = "#d64545";
      view.popup.open({ title: "Atención: Fuera de jurisdicción", content: "Este punto no está dentro de la CAR. El sistema bloqueará el guardado si no lo corrige.", location: mapPoint });
      const locs = rowLocations.get(rowId) || []; const locObj = locs.find(l => l.ptId === ptId);
      if(locObj) { locObj.mun = "Fuera de CAR"; locObj.dane = "N/A"; }
      return;
    }
    locEl.querySelector(".loc-item__header").style.borderBottom = "none";
    locEl.querySelector(".loc-item__header").style.color = "inherit";

    const a = result.features[0].attributes; const keys = Object.keys(a);
    const mun = a[keys.find(k => k.toLowerCase().includes("municipio") || k.toLowerCase().includes("mpio"))] || "";
    const dane = String(a[keys.find(k => k.toLowerCase().includes("dane"))] || "");
    if(munEl) munEl.value = mun; if(daneEl) daneEl.value = dane;
    const locs = rowLocations.get(rowId) || []; const locObj = locs.find(l => l.ptId === ptId);
    if(locObj) { locObj.mun = mun; locObj.dane = dane; }
    view.popup.close();
  }catch(e){ 
      console.error(e); 
      auditError("MAPA_INTERSECT", e, { rowId, ptId });
      setStatus("Error de comunicación al verificar la jurisdicción en el mapa.", "error");
  }finally{ document.body.style.cursor = 'default'; }
}

// --- VALIDACIONES PREVIAS CENTRALIZADAS ---
function validateSelection() {
    let errors = [];
    if (!elVigencia.value) errors.push("Vigencia");
    if (!elPeriodo.value) errors.push("Periodo");
    if (!getActividadId()) errors.push("Actividad");
    return errors;
}

function validateTaskRows(isSubmit) {
    let errorCount = 0;
    let warningCount = 0;
    document.querySelectorAll(".row").forEach(rowEl => {
        if (rowEl.classList.contains("is-readonly") || rowEl.classList.contains("is-not-applicable")) return;
        
        const rowId = rowEl.getAttribute("data-row-id");
        const tareaGid = rowEl.getAttribute("data-tarea-gid");
        const val = rowEl.querySelector(".row-valor")?.value;
        const obs = rowEl.querySelector(".row-obs")?.value;
        const evi = rowEl.querySelector(".row-evi")?.value;
        const motivo = rowEl.querySelector(".row-motivo")?.value;
        const locs = rowLocations.get(rowId) || [];
        
        clearRowMessage(rowId);
        rowEl.classList.remove("row--error", "row--warning");

        locs.forEach(loc => {
            const domLoc = document.getElementById(`loc-${loc.ptId}`);
            if (domLoc) loc.desc = domLoc.querySelector(".loc-desc").value;
        });

        let hasData = (val !== "" && val !== undefined) || (obs && obs.trim() !== "") || (evi && evi.trim() !== "") || locs.length > 0;
        if (!hasData) return;

        let rowErrors = [];
        let rowWarnings = [];

        if (val !== "" && val !== undefined) {
            const numVal = Number(val);
            if (isNaN(numVal)) {
                rowErrors.push("El Valor Reportado debe ser numérico.");
            } else {
                const tipoValor = getTipoValorAvanceByTarea(tareaGid);
                if (tipoValor.includes("PORCENTAJE") || tipoValor === "%") {
                    if (numVal < 0) {
                        rowErrors.push("El porcentaje no puede ser menor a 0.");
                    } else if (numVal > 100) {
                        if (isSubmit) {
                            rowErrors.push("Valor de porcentaje fuera de rango permitido para envío (máx 100).");
                        } else {
                            rowWarnings.push("Esta tarea está configurada como porcentaje. El valor no debe superar 100.");
                        }
                    }
                }
                
                const metaProg = getMetaProgramadaByTarea(tareaGid);
                if (metaProg !== null && numVal > metaProg) {
                    if (isSubmit) {
                        rowErrors.push(`El valor reportado supera la meta programada de la tarea para esta vigencia. Meta programada: ${metaProg}. Valor reportado: ${numVal}.`);
                    } else {
                        rowWarnings.push(`El valor reportado supera la meta programada. Meta: ${metaProg}, Reportado: ${numVal}.`);
                    }
                }
            }
        }

        if (isSubmit) {
            const exist = existingAvances.get(tareaGid);
            if (exist && exist.EstadoRegistro === "Devuelto") {
                if (!motivo || motivo.trim() === "") {
                    rowErrors.push("Falta el motivo de ajuste para la tarea devuelta.");
                }
            }

            locs.forEach(loc => {
                if (loc.mun === "Fuera de CAR" || !loc.mun) {
                    rowErrors.push("Ubicación fuera de jurisdicción CAR.");
                }
            });
        }

        if (rowErrors.length > 0) {
            showRowMessage(rowId, rowErrors.join(" "), "error");
            rowEl.classList.add("row--error");
            errorCount++;
        } else if (rowWarnings.length > 0 && !isSubmit) {
            showRowMessage(rowId, rowWarnings.join(" "), "warning");
            rowEl.classList.add("row--warning");
            warningCount++;
        }
    });
    return { errors: errorCount, warnings: warningCount };
}

function validateTaskRowsForSave() { return validateTaskRows(false); }
function validateTaskRowsForSubmit() { return validateTaskRows(true); }

function validateNarrative(isSubmit) {
    let errors = [];
    let warnings = [];
    clearNarrativeMessage();

    const txt1 = document.getElementById("txt-reporte-narrativo")?.value || "";
    const txt2 = document.getElementById("txt-logros-descripcion")?.value || "";
    const txt3 = document.getElementById("txt-logros-principales")?.value || "";
    const motivoN = document.getElementById("txt-motivo-narrativa")?.value || "";

    const valIndicador = getCurrentIndicadorValue();
    const obsIndicador = byId("txt-observacion-indicador")?.value || "";
    const calc = calculateIndicadorValues(valIndicador);
    const indicadorActivo = isIndicadorActivoEnPlan();

    if (!document.getElementById("txt-reporte-narrativo")?.disabled) {
        if (isSubmit) {
            if (txt1.trim() === "" || txt2.trim() === "" || txt3.trim() === "") {
                errors.push("Los campos Reporte Narrativo, Descripción de logros y Principales logros son obligatorios al enviar.");
            }

            if (indicadorActivo) {
                if (valIndicador === null) {
                    errors.push("Debe registrar el valor trimestral del indicador anual de la actividad.");
                }
                if (calc.meta === null || calc.meta <= 0) {
                    errors.push("La meta anual del indicador no está disponible o no es válida en PLAN_Actividad.");
                }
            }

            if (existingNarrativa && existingNarrativa.EstadoRegistro === "Devuelto") {
                if (motivoN.trim() === "") {
                    errors.push("Falta justificar el motivo de ajuste para la narrativa devuelta.");
                }
            }
        }

        if (valIndicador !== null) {
            if (valIndicador < 0) errors.push("El valor trimestral del indicador no puede ser negativo.");

            if (calc.tipo === "PORCENTUAL" && valIndicador > 100) {
                if (isSubmit) errors.push("El indicador porcentual no puede superar 100 al enviar.");
                else warnings.push("El indicador porcentual no debería superar 100.");
            }

            if (calc.tipo === "NUMERICO" && calc.meta !== null && calc.accumulated !== null && calc.accumulated > calc.meta) {
                if (isSubmit && obsIndicador.trim() === "") {
                    errors.push("El acumulado del indicador supera la meta anual; registre una observación funcional antes de enviar.");
                } else {
                    warnings.push("El acumulado del indicador supera la meta anual. Revise la observación funcional.");
                }
            }
        }

        if (isSubmit) {
            if (getPlanFlag("ReportaODS") === "SI" && (byId("txt-avance-ods")?.value || "").trim() === "") {
                errors.push("Debe diligenciar el avance ODS del periodo porque la actividad lo exige en PLAN_Actividad.");
            }
            if (getPlanFlag("ReportaRezago") === "SI" && (byId("txt-avance-rezago")?.value || "").trim() === "") {
                errors.push("Debe diligenciar el avance de rezago del periodo porque la actividad lo exige en PLAN_Actividad.");
            }
            if (getPlanFlag("ReportaReserva") === "SI" && (byId("txt-avance-reserva")?.value || "").trim() === "") {
                errors.push("Debe diligenciar el avance de reserva del periodo porque la actividad lo exige en PLAN_Actividad.");
            }
        }
    }

    if (errors.length > 0) {
        showNarrativeMessage(errors.join(" "), "error");
    } else if (warnings.length > 0 && !isSubmit) {
        showNarrativeMessage(warnings.join(" "), "warning");
    }
    return { errors: errors.length, warnings: warnings.length };
}

function validateNarrativeForSave() { return validateNarrative(false); }
function validateNarrativeForSubmit() { return validateNarrative(true); }

function validateBeforeSave() {
    clearGlobalMessage();
    let selErrors = validateSelection();
    if (selErrors.length > 0) {
        setStatus("Por favor seleccione: " + selErrors.join(", "), "error");
        return { valid: false, warnings: 0 };
    }
    let taskValidation = validateTaskRowsForSave();
    let narrValidation = validateNarrativeForSave();
    if (taskValidation.errors > 0 || narrValidation.errors > 0) {
        setStatus(`Revise las validaciones inline antes de guardar (${taskValidation.errors} tareas con error, ${narrValidation.errors} errores de reporte consolidado).`, "error");
        return { valid: false, warnings: 0 };
    }
    return { valid: true, warnings: taskValidation.warnings + narrValidation.warnings };
}

function validateBeforeSubmit() {
    clearGlobalMessage();
    let selErrors = validateSelection();
    if (selErrors.length > 0) {
        setStatus("Por favor seleccione: " + selErrors.join(", "), "error");
        return { valid: false, warnings: 0 };
    }
    let taskValidation = validateTaskRowsForSubmit();
    let narrValidation = validateNarrativeForSubmit();
    if (taskValidation.errors > 0 || narrValidation.errors > 0) {
        setStatus(`No se puede enviar a revisión. Corrija los errores indicados (${taskValidation.errors} tareas con error, ${narrValidation.errors} errores de reporte consolidado).`, "error");
        return { valid: false, warnings: 0 };
    }
    return { valid: true, warnings: 0 };
}

// --- GUARDAR Y ENVIAR V4 ---
btnGuardar.addEventListener("click", () => processSave(false));
btnEnviar.addEventListener("click", () => openSubmitPreview());

function openSubmitPreview() {
    if (viewOnlyMode) return setStatus("Modo lectura: no se permiten cambios.", "error");

    const validation = validateBeforeSubmit();
    if (!validation.valid) return; 

    const vig = elVigencia.value;
    const per = getPeriodo();
    const actInput = document.querySelector("#combo-actividad .combo-input");
    const actName = actInput ? actInput.value || "Desconocida" : "Desconocida";

    let tareasFilled = 0;
    let locsCount = 0;

    document.querySelectorAll(".row").forEach(rowEl => {
        if (rowEl.classList.contains("is-readonly") || rowEl.classList.contains("is-not-applicable")) return;
        const rowId = rowEl.getAttribute("data-row-id");
        const val = rowEl.querySelector(".row-valor")?.value;
        const obs = rowEl.querySelector(".row-obs")?.value;
        const evi = rowEl.querySelector(".row-evi")?.value;
        const locs = rowLocations.get(rowId) || [];

        let hasData = (val !== "" && val !== undefined) || (obs && obs.trim() !== "") || (evi && evi.trim() !== "") || locs.length > 0;
        if (hasData) {
            tareasFilled++;
            locsCount += locs.length;
        }
    });

    const txt1 = document.getElementById("txt-reporte-narrativo")?.value.trim() !== "" ? "Sí" : "No";
    const txt2 = document.getElementById("txt-logros-descripcion")?.value.trim() !== "" ? "Sí" : "No";
    const txt3 = document.getElementById("txt-logros-principales")?.value.trim() !== "" ? "Sí" : "No";
    const calcInd = calculateIndicadorValues();
    const odsReq = getPlanFlag("ReportaODS") === "SI" ? ((byId("txt-avance-ods")?.value || "").trim() !== "" ? "Sí" : "Pendiente") : "No aplica";
    const rezReq = getPlanFlag("ReportaRezago") === "SI" ? ((byId("txt-avance-rezago")?.value || "").trim() !== "" ? "Sí" : "Pendiente") : "No aplica";
    const resReq = getPlanFlag("ReportaReserva") === "SI" ? ((byId("txt-avance-reserva")?.value || "").trim() !== "" ? "Sí" : "Pendiente") : "No aplica";

    const summaryHtml = `
        <div class="summary-item"><strong>Vigencia / Periodo:</strong> <span>${vig} - ${per}</span></div>
        <div class="summary-item"><strong>Actividad:</strong> <span style="max-width:60%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(actName)}">${escapeHtml(actName)}</span></div>
        <div class="summary-item"><strong>Tareas con datos:</strong> <span>${tareasFilled}</span></div>
        <div class="summary-item"><strong>Ubicaciones registradas:</strong> <span>${locsCount}</span></div>
        <div class="summary-item"><strong>Estado esperado:</strong> <span class="status-badge status-badge--enviado" style="margin:0;">Enviado</span></div>
        <div style="margin-top:8px; font-weight:bold; font-size:12px; color:var(--muted); text-transform:uppercase;">Resumen de Narrativa</div>
        <div class="summary-item"><strong>Reporte Narrativo:</strong> <span>${txt1}</span></div>
        <div class="summary-item"><strong>Descripción de logros:</strong> <span>${txt2}</span></div>
        <div class="summary-item"><strong>Principales logros:</strong> <span>${txt3}</span></div>
        <div style="margin-top:8px; font-weight:bold; font-size:12px; color:var(--muted); text-transform:uppercase;">Indicador y componentes especiales</div>
        <div class="summary-item"><strong>Indicador:</strong> <span>${escapeHtml(planActCtx?.IndicadorID || "N/A")}</span></div>
        <div class="summary-item"><strong>Valor trimestre:</strong> <span>${calcInd.current === null ? "No registrado" : formatNumberForUi(calcInd.current)}</span></div>
        <div class="summary-item"><strong>Acumulado / %:</strong> <span>${calcInd.accumulated === null ? "N/D" : formatNumberForUi(calcInd.accumulated)} / ${calcInd.pct === null ? "N/D" : formatNumberForUi(calcInd.pct) + "%"}</span></div>
        <div class="summary-item"><strong>ODS / Rezago / Reserva:</strong> <span>${odsReq} / ${rezReq} / ${resReq}</span></div>
    `;

    document.getElementById("modal-summary-content").innerHTML = summaryHtml;

    const warningsEl = document.getElementById("modal-warnings");
    if (validation.warnings > 0) {
        warningsEl.innerHTML = `⚠️ Se detectaron ${validation.warnings} advertencia(s) no bloqueante(s). El envío procede bajo su responsabilidad.`;
        warningsEl.style.display = "flex";
    } else {
        warningsEl.style.display = "none";
    }

    document.getElementById("submit-modal").style.display = "flex";
}

function closeSubmitModal() {
    document.getElementById("submit-modal").style.display = "none";
}

document.getElementById("btn-close-submit")?.addEventListener("click", closeSubmitModal);
document.getElementById("btn-cancel-submit")?.addEventListener("click", closeSubmitModal);
document.getElementById("btn-confirm-submit")?.addEventListener("click", () => {
    closeSubmitModal();
    processSave(true);
});

async function processSave(isSubmit) {
  if (viewOnlyMode) return setStatus("Modo lectura: no se permiten cambios.", "error");

  const validation = isSubmit ? validateBeforeSubmit() : validateBeforeSave();
  if (!validation.valid) return; 

  try {
    btnGuardar.disabled = true; btnEnviar.disabled = true;
    
    const draft = collectDraft(isSubmit);
    let hasChanges = draft.adds.length || draft.updates.length || draft.ubicAdds.length || draft.ubicUpdates.length || deletedLocations.length || draft.narrAdds.length || draft.narrUpdates.length;
    
    if (isSubmit) {
        if (!existingNarrativa && draft.narrAdds.length === 0) {
            setStatus("Debe guardar o diligenciar el reporte consolidado antes de enviar a revisión.", "error");
            return;
        }

        // REGLA OBLIGATORIA: Forzar actualización de estado y metadatos operativos si no fueron capturados
        if (existingNarrativa && !["Enviado", "Aprobado", "Publicado", "EnRevision"].includes(existingNarrativa.EstadoRegistro)) {
            const inDraft = draft.narrUpdates.find(u => u.attributes.OBJECTID === existingNarrativa.OBJECTID);
            if (!inDraft) {
                draft.narrUpdates.push({
                    attributes: {
                        OBJECTID: existingNarrativa.OBJECTID,
                        EstadoRegistro: "Enviado",
                        PersonaUltimaEdicionID: currentUser.pid,
                        FechaUltimaEdicionFuncional: Date.now(),
                        MotivoAjuste: document.getElementById("txt-motivo-narrativa")?.value || "",
                        Version: (existingNarrativa.Version || 1) + 1
                    }
                });
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await executeSave(draft);
        }

        // Resolucion integral de workflow centralizado
        const actGid = getActividadId();
        const vig = Number(elVigencia.value);
        const per = getPeriodo();
        const claveUnica = `${actGid}|${vig}|${per}`;

        let expectedVersion = 1;
        if (existingNarrativa) expectedVersion = existingNarrativa.Version || 1;
        if (draft.narrUpdates.length > 0) expectedVersion = (existingNarrativa.Version || 1) + 1;

        const resolvedNarrativa = await resolveNarrativaAfterSave({ 
            actividadGlobalID: actGid, 
            vigencia: vig, 
            periodo: per, 
            version: expectedVersion,
            claveUnicaReporteActividad: claveUnica 
        });
        
        if (!resolvedNarrativa) {
             throw new Error("No se pudo confirmar el guardado del reporte consolidado.");
        }

        let currentPlanAct = planActCtx;
        if (!currentPlanAct || !currentPlanAct.TipoFlujoWorkflow) {
             currentPlanAct = await resolvePlanActividadWorkflow(actGid, vig);
             if (!currentPlanAct) throw new Error("No se pudo resolver la planeación de la actividad para crear la solicitud de revisión.");
        }

        const wfResult = await createOrUpdateWorkflowSolicitudFromNarrativa({
            narrativaAttrs: resolvedNarrativa,
            planAct: currentPlanAct,
            isSubmit: isSubmit
        });

        const inputAct = document.querySelector("#combo-actividad .combo-input");
        const actName = inputAct ? inputAct.value : 'Desconocida';
        await writeAuditEvent("ENVIAR_REVISION", "APP_REPORTE", "OK", `Actividad: ${actName}. Workflow creado/actualizado. Estado: ${wfResult.estado}`);

        let successMsg = "";
        if (wfResult.action === "created") {
            successMsg = `Reporte enviado a revisión. Se creó la solicitud de workflow dinámico para el rol: ${wfResult.role}.`;
        } else if (wfResult.action === "updated") {
            successMsg = `Reporte reenviado a revisión. Se actualizó la solicitud de workflow existente para el rol: ${wfResult.role}.`;
        } else if (wfResult.action === "default_fallback") {
            successMsg = `Reporte enviado a revisión. La actividad no tenía tipo de flujo configurado. Se aplicó el flujo COMPLETO por defecto.`;
        } else {
            successMsg = "Reporte enviado a revisión.";
        }

        setStatus(successMsg, "success");
        await loadExistingData(actGid); 
        evaluateHistoricalMode();

    } else {
        if (!hasChanges) {
           setStatus("No hay cambios operativos para guardar.", "info"); 
           return;
        }
        await executeSave(draft);
        const inputAct = document.querySelector("#combo-actividad .combo-input");
        const actName = inputAct ? inputAct.value : 'Desconocida';
        await writeAuditEvent("GUARDAR_BORRADOR", "APP_REPORTE", "OK", `Actividad: ${actName}. Tareas afect: ${draft.adds.length + draft.updates.length}.`);
        
        let successMsg = "Borrador guardado exitosamente.";
        if (validation.warnings > 0) successMsg = `Se guardó el borrador, pero revise las advertencias de los valores reportados (${validation.warnings} advertencias).`;
        setStatus(successMsg, validation.warnings > 0 ? "warning" : "success");
        await loadExistingData(getActividadId()); 
        evaluateHistoricalMode();
    }

  } catch(e) { 
      console.error(e); 
      setStatus(e.message || "Fallo en la preparación de datos.", "error"); 
      auditError(isSubmit ? "SUBMIT_REVISION" : "SAVE_BORRADOR", e, { isSubmit });
  } finally { 
      btnGuardar.disabled = false; btnEnviar.disabled = false; 
  }
}

function collectDraft(isSubmit) {
  const actGid = getActividadId(), vig = Number(elVigencia.value), per = getPeriodo();
  const epochNow = Date.now();
  const res = { actGid, adds: [], updates: [], ubicAdds: [], ubicUpdates: [], narrAdds: [], narrUpdates: [] };
  
  // AVANCES TAREAS
  document.querySelectorAll(".row").forEach(rowEl => {
    if(rowEl.classList.contains("is-readonly") || rowEl.classList.contains("is-not-applicable")) return; 
    
    const tareaGid = rowEl.getAttribute("data-tarea-gid"), rowId = rowEl.getAttribute("data-row-id");
    const val = rowEl.querySelector(".row-valor")?.value, obs = rowEl.querySelector(".row-obs")?.value, evi = rowEl.querySelector(".row-evi")?.value;
    const motivo = rowEl.querySelector(".row-motivo")?.value;
    const locs = rowLocations.get(rowId) || [];

    if(!val && !obs && !evi && locs.length === 0) return; 

    const exist = existingAvances.get(tareaGid);
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
  });

  // REPORTE CONSOLIDADO DE ACTIVIDAD / NARRATIVA
  if(!document.getElementById("txt-reporte-narrativo").disabled) {
    const txt1 = document.getElementById("txt-reporte-narrativo").value;
    const txt2 = document.getElementById("txt-logros-descripcion").value;
    const txt3 = document.getElementById("txt-logros-principales").value;
    const motivoN = document.getElementById("txt-motivo-narrativa")?.value;

    const valorIndicador = getCurrentIndicadorValue();
    const calc = calculateIndicadorValues(valorIndicador);
    const obsIndicador = byId("txt-observacion-indicador")?.value || "";
    const eviIndicador = byId("txt-evidencia-indicador")?.value || "";
    const avanceODS = byId("txt-avance-ods")?.value || "";
    const avanceRezago = byId("txt-avance-rezago")?.value || "";
    const avanceReserva = byId("txt-avance-reserva")?.value || "";

    const hasNarrativePayload = [txt1, txt2, txt3, obsIndicador, eviIndicador, avanceODS, avanceRezago, avanceReserva].some(v => String(v || "").trim() !== "") || valorIndicador !== null;

    if(hasNarrativePayload) {
      const estadoNuevoN = isSubmit ? "Enviado" : (existingNarrativa ? existingNarrativa.EstadoRegistro : "Borrador");
      const baseN = {
        [F_NAR.estado]: estadoNuevoN,
        [F_NAR.pEdic]: currentUser.pid,
        [F_NAR.fEdic]: epochNow,
        [F_NAR.motivo]: motivoN || "",
        [F_NAR.txt1]: txt1,
        [F_NAR.txt2]: txt2,
        [F_NAR.txt3]: txt3,
        [F_NAR.respGid]: currentUser.gid,
        [F_NAR.planAct]: planActCtx?.GlobalID || null,
        [F_NAR.indId]: planActCtx?.IndicadorID || null,
        [F_NAR.indNom]: planActCtx?.NombreIndicador || null,
        [F_NAR.indTipo]: getPlanTipoIndicador(),
        [F_NAR.indUnidad]: planActCtx?.UnidadMedida || null,
        [F_NAR.indCalc]: planActCtx?.TipoCalculoAvanceActividad || null,
        [F_NAR.clave]: `${actGid}|${vig}|${per}`,
        [F_NAR.meta]: calc.meta,
        [F_NAR.valTri]: valorIndicador,
        [F_NAR.valAcum]: calc.accumulated,
        [F_NAR.pct]: calc.pct,
        [F_NAR.obsInd]: obsIndicador,
        [F_NAR.eviInd]: eviIndicador,
        [F_NAR.odsPlan]: getPlanFlag("ReportaODS"),
        [F_NAR.odsTxt]: getPlanFlag("ReportaODS") === "SI" ? avanceODS : "",
        [F_NAR.rezPlan]: getPlanFlag("ReportaRezago"),
        [F_NAR.rezTxt]: getPlanFlag("ReportaRezago") === "SI" ? avanceRezago : "",
        [F_NAR.resPlan]: getPlanFlag("ReportaReserva"),
        [F_NAR.resTxt]: getPlanFlag("ReportaReserva") === "SI" ? avanceReserva : ""
      };
      
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
    }
  }
  return res;
}

// Validación de responses estricta requerida para UAT
async function executeSave(draft) {
  const validateResults = (results, operation) => {
    if (results && Array.isArray(results)) {
      for (const r of results) {
        if (r.success === false) {
          throw new Error(`Fallo en ${operation}: ${r.error?.description || JSON.stringify(r.error)}`);
        }
      }
    }
  };

  const applyAndCheck = async (url, payload) => {
    const data = await postForm(`${url}/applyEdits`, payload);
    validateResults(data.addResults, "adds");
    validateResults(data.updateResults, "updates");
    validateResults(data.deleteResults, "deletes");
    return data;
  };

  try {
    if(draft.adds.length || draft.updates.length) await applyAndCheck(URL_AVANCE_TAREA, { f: "json", adds: draft.adds, updates: draft.updates });
    if(draft.ubicAdds.length || draft.ubicUpdates.length || deletedLocations.length) await applyAndCheck(URL_TAREA_UBICACION, { f:"json", adds: draft.ubicAdds, updates: draft.ubicUpdates, deletes: deletedLocations });
    if(draft.narrAdds.length || draft.narrUpdates.length) await applyAndCheck(URL_NARRATIVA, { f:"json", adds: draft.narrAdds, updates: draft.narrUpdates });
  } catch(e) {
    auditError("APPLY_EDITS_API", e, { draftStats: { a: draft.adds.length, u: draft.updates.length } });
    const customErr = new Error(`Falla en la sincronización de datos con el servidor principal: ${e.message}`);
    customErr._audited = true; 
    throw customErr;
  }
}

// --- Limpieza UI ---
function clearForm(){
  clearGlobalMessage();
  clearNarrativeMessage();
  if (elSubactNav) elSubactNav.style.display = "none";
  if (elTopSubactSelector) elTopSubactSelector.style.display = "none";
  if(document.getElementById("txt-reporte-narrativo")) document.getElementById("txt-reporte-narrativo").value = ""; if(document.getElementById("txt-logros-descripcion")) document.getElementById("txt-logros-descripcion").value = ""; if(document.getElementById("txt-logros-principales")) document.getElementById("txt-logros-principales").value = ""; clearReporteConsolidadoFields(true);
  rowLocations.clear(); clearMapGraphics(); activeRowId = null; pillActive.textContent = "Tarea activa para georreferenciar: —";
  document.querySelectorAll(".row").forEach(r => {
    r.classList.remove("row--active");
    r.querySelector(".row-valor").value = ""; r.querySelector(".row-obs").value = ""; r.querySelector(".row-evi").value = "";
    const locList = r.querySelector(".loc-list"); if(locList) locList.innerHTML = "";
    r.classList.remove("row--error", "row--warning");
  });
  refreshSupportPanel();
}
btnLimpiar.addEventListener("click", () => { clearForm(); setStatus("Vista limpiada.", "info"); });

// --- Botón Recargar ---
btnRefresh.addEventListener("click", async () => { 
    if(elVigencia.value && currentUser) {
        setStatus("Recargando asignaciones y actividades...", "info");
        clearForm();
        elIndicadores.innerHTML = "";
        actContextPanel.style.display = "none";
        document.getElementById("narrativa-badge-container").innerHTML = "";
        clearReporteConsolidadoFields(true);
        document.getElementById("container-motivo-narrativa").style.display = "none";
        elModo.style.display = "none";
        viewOnlyMode = false;
        if (elSubactNav) elSubactNav.style.display = "none";
        if (elTopSubactSelector) elTopSubactSelector.style.display = "none";
        
        renderCombo("combo-actividad", [], "Cargando...");
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
    actContextPanel.style.display = "none";
    document.getElementById("narrativa-badge-container").innerHTML = "";
    document.getElementById("container-motivo-narrativa").style.display = "none";
    elModo.style.display = "none"; 
    viewOnlyMode = false;
    if (elSubactNav) elSubactNav.style.display = "none";
    if (elTopSubactSelector) elTopSubactSelector.style.display = "none";
    
    renderCombo("combo-actividad", [], "Cargando...");
    await loadAsignaciones(); 
    await loadActividades(); 
    setStatus("Asignaciones actualizadas.", "success");
});

// Evento de Cambio de Periodo nativo
elPeriodo.addEventListener("change", async () => {
    const actGid = getActividadId();
    if (actGid) {
        await loadSubactividadesYTareas(actGid);
        refreshSupportPanel();
    }
});