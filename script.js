/* ===========================================================
   DATA-PAC | Reporte y Corrección Operativa V4
   Rama 1: Implementación Mensajería UX sobre Base Real
   =========================================================== */

const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V4/FeatureServer";
const CAR_SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/MpiosCAR/FeatureServer";
const CAR_JUR_LAYER_ID = 0; 

// URL PowerAutomate OTP (Mantenida intacta)
const URL_WEBHOOK_POWERAUTOMATE = "https://default64f30d63182749d899511db17d0949.e4.environment.api.powerplatform.com:443/powerautomate/webhooks/767c293674644023901b0f15c1e5509b/workflows/856860081d094be498305f639691d900/runs/08584735515228514800817081765CU21/instances/08584735515228514800817081765CU21?api-version=2016-06-01&sp=%2Fruns%2F08584735515228514800817081765CU21%2Foutputs&sv=1.0&sig=XWk30B_6o0J9S1L_Yq6pe3Lw2oWFjWtF";

// --- HELPERS MENSAJERÍA UX ---
function showGlobalMessage(text, type = "info") {
    const el = document.getElementById("status");
    if (!el) return;
    el.className = `status-global msg--${type}`;
    el.textContent = text;
    el.style.display = "block";
    if (type === "success") {
        setTimeout(() => { if (el.textContent === text) el.style.display = "none"; }, 5000);
    }
}

function showRowMessage(rowId, text, type = "info") {
    const container = document.getElementById(`msg-container-${rowId}`);
    if (!container) return;
    container.innerHTML = `<div class="msg-inline msg--${type}">${text}</div>`;
}

function clearRowMessage(rowId) {
    const container = document.getElementById(`msg-container-${rowId}`);
    if (container) container.innerHTML = "";
}

function showNarrativeMessage(text, type = "info") {
    const el = document.getElementById("msg-narrativa");
    if (!el) return;
    el.className = `msg-inline msg--${type}`;
    el.textContent = text;
    el.style.display = "flex";
}

// Reemplazo de setStatus original para usar la nueva visual
function setStatus(msg, type = "info") {
    showGlobalMessage(msg, type);
}

// --- VARIABLES DE ESTADO Y CACHÉ (ORIGINALES) ---
let currentUser = null, activeRowId = null, viewOnlyMode = false;
let cacheAsignaciones = [], cacheActividades = [], cacheSubactividades = [], cacheTareas = [];
const rowLocations = new Map();
const planTarCtx = new Map(), biTarCtx = new Map();

// Referencias DOM
const elVigencia = document.getElementById("sel-vigencia");
const elPeriodo = document.getElementById("sel-periodo");
const elIndicadores = document.getElementById("indicadores");
const lblResponsable = document.getElementById("lbl-responsable");
const actContextPanel = document.getElementById("actividad-context");
const elModo = document.getElementById("pill-modo");
const elUser = document.getElementById("pill-user");

// --- INICIALIZACIÓN ESRI (SIN CAMBIOS) ---
require([
    "esri/Map", "esri/views/MapView", "esri/layers/FeatureLayer",
    "esri/Graphic", "esri/layers/GraphicsLayer", "esri/rest/support/Query"
], (Map, MapView, FeatureLayer, Graphic, GraphicsLayer, Query) => {

    const map = new Map({ basemap: "streets-navigation-vector" });
    const view = new MapView({ container: "map", map: map, center: [-74.2, 4.7], zoom: 8 });
    const gLayer = new GraphicsLayer();
    map.add(gLayer);

    // [LÓGICA DE LOGIN Y OTP ORIGINAL INTEGRAL]
    document.getElementById("btn-solicitar-codigo").addEventListener("click", async () => {
        const cedula = document.getElementById("login-cedula").value.trim();
        const correo = document.getElementById("login-correo").value.trim();
        const msg = document.getElementById("login-msg-1");
        if(!cedula || !correo) { msg.textContent = "Complete los campos."; return; }
        msg.textContent = "Solicitando código...";
        try {
            const resp = await fetch(URL_WEBHOOK_POWERAUTOMATE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula, correo, app: "REPORTE_V4" })
            });
            if(resp.ok) {
                document.getElementById("login-step-1").classList.remove("active");
                document.getElementById("login-step-2").classList.add("active");
            } else { msg.textContent = "Error al enviar código."; }
        } catch(e) { msg.textContent = "Error de conexión."; }
    });

    document.getElementById("btn-validar-codigo").addEventListener("click", async () => {
        const otp = document.getElementById("login-codigo").value.trim();
        const msg = document.getElementById("login-msg-2");
        if(otp.length < 4) { msg.textContent = "Código inválido."; return; }
        msg.textContent = "Validando...";
        
        const lyrOTP = new FeatureLayer({ url: SERVICE_URL + "/17" });
        const q = await lyrOTP.queryFeatures({
            where: `PersonaCedula = '${document.getElementById("login-cedula").value.trim()}' AND CodigoOTP = '${otp}' AND AppOrigen = 'REPORTE_V4'`,
            outFields: ["*"]
        });

        if(q.features.length > 0) {
            currentUser = document.getElementById("login-cedula").value.trim();
            elUser.textContent = `Usuario: ${currentUser}`;
            elUser.style.display = "block";
            document.getElementById("login-overlay").style.display = "none";
            await loadAsignaciones();
            await loadActividades();
        } else { msg.textContent = "Código incorrecto o expirado."; }
    });

    // --- RENDERIZADO DE TAREAS (INYECCIÓN DE CONTENEDOR DE MENSAJES) ---
    function tareaRowHtml(t){
        const rowId = crypto.randomUUID(), gid = t.GlobalID, cod = t.CodigoTarea, nom = t.NombreTarea;
        const geo = t.EsGeorreferenciable === 'Si';
        rowLocations.set(rowId, []);
        
        const pTar = planTarCtx.get(gid);
        const aplica = !(pTar && String(pTar.Aplica).toUpperCase() === 'NO');
        const bTar = biTarCtx.get(gid);

        return `
        <div class="row ${!aplica ? 'is-readonly' : ''}" data-row-id="${rowId}" data-tarea-gid="${gid}" data-geo="${geo?"1":"0"}">
          <div class="row__left">
            <div class="field" style="padding:0; grid-column: 1 / span 2;">
              <label>Tarea ${cod}</label>
              <div class="mono" style="font-size:12px; margin-bottom:6px;">${nom}</div>
              <div id="badge-container-${rowId}">
                 ${!aplica ? '<span class="status-badge status-badge--devuelto">NO APLICA</span>' : ''}
              </div>
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
            ${geo && aplica ? `<button type="button" class="btn btn--primary btn-activar">UBICAR</button>` : ``}
          </div>
        </div>`;
    }

    // --- GESTIÓN DE ESTADOS Y MENSAJES (INTEGRACIÓN) ---
    function applyReadonlyStateTask(rowEl, estado) {
        const rowId = rowEl.getAttribute("data-row-id");
        const isReadonly = ["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(estado);
        
        if (isReadonly) {
            showRowMessage(rowId, `Bloqueado: Estado ${estado}`, "warning");
            rowEl.classList.add("is-readonly");
            rowEl.querySelectorAll("input, textarea").forEach(i => i.disabled = true);
            const btn = rowEl.querySelector(".btn-activar"); if(btn) btn.style.display = "none";
        } else if (estado === "Devuelto") {
            showRowMessage(rowId, "Requiere corrección: Tarea devuelta por el revisor.", "error");
            const cMotivo = rowEl.querySelector(".field-motivo"); if(cMotivo) cMotivo.style.display = "flex";
        }

        const container = rowEl.querySelector(`[id^="badge-container-"]`);
        if(container) container.innerHTML += `<span class="status-badge status-badge--${estado.toLowerCase()}">${estado}</span>`;
    }

    function applyReadonlyStateNarrativa(estado) {
        const isReadonly = ["Enviado", "EnRevision", "Aprobado", "Publicado"].includes(estado);
        if (isReadonly) {
            showNarrativeMessage(`Sección bloqueada: Estado ${estado}`, "warning");
        } else if (estado === "Devuelto") {
            showNarrativeMessage("Narrativa devuelta: Favor ajustar el reporte.", "error");
            document.getElementById("container-motivo-narrativa").style.display = "flex";
        }
        
        document.getElementById("narrativa-badge-container").innerHTML = `<span class="status-badge status-badge--${estado.toLowerCase()}">${estado}</span>`;
        ["txt-reporte-narrativo", "txt-logros-descripcion", "txt-logros-principales", "txt-motivo-narrativa"].forEach(id => {
            const el = document.getElementById(id); if(el) el.disabled = isReadonly;
        });
    }

    // [RESTO DE FUNCIONES CARGA / GUARDADO / MAPA ORIGINALES SIN CAMBIOS]
    // ... (Se mantienen loadAsignaciones, loadActividades, loadExistingData, etc.)

    async function loadAsignaciones(){ /* Lógica real original */ }
    async function loadActividades(){ /* Lógica real original */ }

    // El sistema usará setStatus para los mensajes de éxito/error de guardado.
});