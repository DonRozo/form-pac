/* ===========================================================
   DATA-PAC | Reporte y Corrección Operativa V4
   Rama 1: Capa de Mensajería UX Estandarizada
   =========================================================== */

const SERVICE_URL = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/DATAPAC_V4/FeatureServer";
const URL_WEBHOOK_OTP = "https://default64f30d63182749d899511db17d0949.e4.environment.api.powerplatform.com:443/powerautomate/webhooks/...";

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
    const container = document.getElementById("msg-narrativa");
    if (!container) return;
    container.innerHTML = `<div class="msg-inline msg--${type}">${text}</div>`;
}

// Compatibilidad con código previo
function setStatus(msg, type="info") { showGlobalMessage(msg, type); }

// --- VARIABLES DE ESTADO ---
let currentUser = null, activeRowId = null, viewOnlyMode = false;
let cacheAsignaciones = [], cacheActividades = [], cacheSubactividades = [], cacheTareas = [];
const rowLocations = new Map();

// --- INICIALIZACIÓN ESRI ---
require(["esri/Map", "esri/views/MapView", "esri/layers/FeatureLayer", "esri/Graphic"], 
(Map, MapView, FeatureLayer, Graphic) => {

    const map = new Map({ basemap: "streets-navigation-vector" });
    const view = new MapView({ container: "map", map: map, center: [-74.2, 4.7], zoom: 8 });

    // --- RENDERIZADO DE TAREAS ---
    function tareaRowHtml(t) {
        const rowId = crypto.randomUUID();
        const gid = t.GlobalID;
        const aplica = t.Aplica !== "No";
        
        return `
        <div class="row ${!aplica ? 'is-readonly' : ''}" data-row-id="${rowId}" data-tarea-gid="${gid}" data-geo="${t.EsGeorreferenciable === 'Si' ? '1':'0'}">
            <div class="row__left">
                <div style="font-size:11px; font-weight:800; color:var(--muted);">${t.CodigoTarea}</div>
                <div style="font-size:13px; font-weight:600; margin-bottom:8px;">${t.NombreTarea}</div>
                
                <div id="msg-container-${rowId}" class="row__messages"></div>

                <div class="field" style="padding:0; margin-bottom:8px;">
                    <label>Valor Reportado</label>
                    <input type="number" class="row-valor" step="any" ${!aplica ? 'disabled' : ''} />
                </div>
                <div class="field" style="padding:0;">
                    <label>Observaciones</label>
                    <textarea class="row-obs" rows="2" ${!aplica ? 'disabled' : ''}></textarea>
                </div>
            </div>
            <div class="row__right">
                ${t.EsGeorreferenciable === 'Si' && aplica ? 
                  `<button class="btn btn--ghost btn-activar" style="width:100%; font-size:10px;">UBICAR</button>` : ''}
            </div>
        </div>`;
    }

    // --- LÓGICA DE BLOQUEOS POR ESTADO ---
    async function applyBusinessRules(rowEl, data) {
        const rowId = rowEl.getAttribute("data-row-id");
        const estado = data.Estado || "Borrador";
        
        // 1. Mensaje de bloqueo por estado
        if (["Enviado", "EnRevision", "Aprobado"].includes(estado)) {
            showRowMessage(rowId, `Lectura bloqueada: Tarea en estado ${estado}`, "warning");
            rowEl.classList.add("is-readonly");
            rowEl.querySelectorAll("input, textarea, button").forEach(el => el.disabled = true);
        }

        // 2. Mensaje por devolución
        if (estado === "Devuelto") {
            showRowMessage(rowId, "Tarea devuelta: Favor corregir según observaciones.", "error");
        }

        // 3. Validación No Aplica
        if (rowEl.classList.contains("is-readonly") && !data.GlobalID) {
             showRowMessage(rowId, "Tarea no aplica para este periodo.", "info");
        }
    }

    // --- EVENTOS DE UI ---
    document.getElementById("btn-guardar").addEventListener("click", () => {
        // Simulación de validación local
        setStatus("Guardando borrador en el servidor...", "info");
        setTimeout(() => setStatus("Borrador guardado correctamente.", "success"), 1500);
    });

    document.getElementById("btn-enviar").addEventListener("click", () => {
        const confirmacion = confirm("¿Está seguro de enviar el reporte? Se bloqueará la edición.");
        if(confirmacion) setStatus("Reporte enviado a revisión.", "success");
    });

    // --- LOGIN SIMULADO (PARA PRUEBAS DE UI) ---
    document.getElementById("btn-solicitar-codigo").onclick = () => {
        document.getElementById("login-step-1").classList.remove("active");
        document.getElementById("login-step-2").classList.add("active");
    };

    document.getElementById("btn-validar-codigo").onclick = () => {
        document.getElementById("login-overlay").style.display = "none";
        setStatus("Bienvenido a DATA-PAC V4. Seleccione una actividad.", "info");
    };

    // Renderizado de ejemplo para visualizar mensajes UX
    window.renderMockTasks = () => {
        const container = document.getElementById("indicadores");
        container.innerHTML = `
            <div class="subact-card">
                <div class="subact-header"><span class="subact-title">Subactividad de Prueba</span></div>
                ${tareaRowHtml({CodigoTarea: "T1", NombreTarea: "Tarea Enviada (Bloqueada)", EsGeorreferenciable: "No"})}
                ${tareaRowHtml({CodigoTarea: "T2", NombreTarea: "Tarea No Aplica", EsGeorreferenciable: "No", Aplica: "No"})}
                ${tareaRowHtml({CodigoTarea: "T3", NombreTarea: "Tarea en Borrador", EsGeorreferenciable: "Si"})}
            </div>
        `;
        
        // Aplicar mensajes de ejemplo tras el render
        const rows = container.querySelectorAll(".row");
        showRowMessage(rows[0].dataset.rowId, "Modo lectura: La tarea ya fue enviada.", "warning");
        showRowMessage(rows[1].dataset.rowId, "Esta tarea no aplica para el periodo actual.", "info");
        showNarrativeMessage("Escriba aquí los logros más importantes del periodo.", "info");
    };

    // Ejecutar render de prueba si no hay datos
    setTimeout(window.renderMockTasks, 1000);

});