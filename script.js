// Función para generar un GUID/UUID (tipo Survey123 uuid())
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const serviceUrl = "https://services6.arcgis.com/yq6pe3Lw2oWFjWtF/arcgis/rest/services/PGAR_PAC_vista_temporal/FeatureServer";
    
    // IDs de las tablas/capas en el Feature Service
    const actividadLayerId = 1; 
    const avanceActividadTableId = 2; 
    
    // IDs ACTUALIZADOS según tu última información:
    const subActividadLayerId = 31; // NUEVO: SubActividad (solo lectura)
    const avanceSubActividadTableId = 3; // NUEVO: AvanceSubActividadTrimestral (lectura/escritura)

    // Elementos del DOM
    const selectActividad = document.getElementById('select-actividad');
    const selectTrimestre = document.getElementById('select-trimestre');
    const actividadReportContainer = document.getElementById('actividad-report-container');
    const actividadBody = document.getElementById('actividad-body');
    const subactividadesReportContainer = document.getElementById('subactividades-report-container');
    const subactividadesSections = document.getElementById('subactividades-sections'); // Nuevo contenedor
    const reporteForm = document.getElementById('reporte-form');
    const btnSubmit = document.getElementById('btn-submit');
    const mensajeEstado = document.getElementById('mensaje-estado');
    
    // Valores de dominio para campos de selección (solo para AvanceActividadTrimestral, el resto se deja App)
    const origenCargaDomain = [
        { code: "Excel", name: "Excel" },
        { code: "App", name: "App" },
        { code: "API", name: "API" },
        { code: "CargaMasiva", name: "Carga Masiva" },
        { code: "Integracion", name: "Integración" }
    ];
    
    /**
     * Función de ayuda para realizar consultas REST a ArcGIS Online.
     */
    async function queryArcGIS(layerId, params) {
        const url = `${serviceUrl}/${layerId}/query`;
        const defaultParams = {
            f: 'json',
            outFields: '*',
            returnGeometry: false,
        };
        const queryParams = new URLSearchParams({...defaultParams, ...params});
        
        try {
            const response = await fetch(`${url}?${queryParams.toString()}`);
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.features || [];
        } catch (error) {
            console.error(`Error al consultar Layer ${layerId}:`, error);
            // No mostramos mensaje de error aquí para evitar spam de mensajes al cargar múltiples tablas
            return [];
        }
    }

    // 1. Cargar las Actividades en la lista desplegable.
    async function loadActivities() {
        mostrarMensaje('Cargando Actividades...', 'info');
        
        const activities = await queryArcGIS(actividadLayerId, {
             where: "Estado = 'Activo'",
             outFields: 'ActividadID, CodigoActividad, Nombre',
             orderByFields: 'CodigoActividad'
        });

        if (activities.length > 0) {
            selectActividad.innerHTML = '<option value="">Seleccione una Actividad</option>';
            activities.forEach(feature => {
                const attr = feature.attributes;
                const option = document.createElement('option');
                option.value = attr.ActividadID;
                option.textContent = `${attr.CodigoActividad} - ${attr.Nombre}`;
                selectActividad.appendChild(option);
            });
             mostrarMensaje('Actividades cargadas.', 'info');
        } else {
            selectActividad.innerHTML = '<option value="">No se encontraron Actividades activas</option>';
            mostrarMensaje('No se encontraron actividades. Revise el Layer ID 1.', 'error');
        }
    }
    
    // 2. Cargar y renderizar el reporte a nivel de ACTIVIDAD
    async function loadActividadReport(actividadID, trimestre) {
        actividadBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando avance de la Actividad...</td></tr>';

        const year = new Date().getFullYear();
        
        const avances = await queryArcGIS(avanceActividadTableId, {
            where: `ActividadID = '${actividadID}' AND Anio = ${year} AND Trimestre = '${trimestre}'`,
            outFields: 'ActividadID, GlobalID, ValorEjecutado, PorcentajeAvance, Observaciones, OrigenCarga, FechaCalculo'
        });

        const avance = avances.length > 0 ? avances[0].attributes : {};
        const globalIDAvance = avance.GlobalID || '';
        
        const origenOptions = origenCargaDomain.map(d => 
            `<option value="${d.code}" ${avance.OrigenCarga === d.code ? 'selected' : ''}>${d.name}</option>`
        ).join('');

        const fechaCalculoFormatted = avance.FechaCalculo ? new Date(avance.FechaCalculo).toISOString().split('T')[0] : '';

        actividadBody.innerHTML = `
            <tr>
                <td>
                    <input type="number" step="any" min="0" class="table-input" id="act-valor-ejecutado" value="${avance.ValorEjecutado || ''}" required>
                </td>
                <td>
                    <input type="number" step="any" min="0" max="100" class="table-input" id="act-porcentaje-avance" value="${avance.PorcentajeAvance || ''}">
                </td>
                <td>
                    <input type="date" class="table-input" id="act-fecha-calculo" value="${fechaCalculoFormatted}">
                </td>
                <td>
                    <select class="table-select" id="act-origen-carga">
                        ${origenOptions}
                    </select>
                </td>
                <td>
                    <textarea class="table-textarea" id="act-observaciones">${avance.Observaciones || ''}</textarea>
                </td>
            </tr>
        `;
        
        actividadReportContainer.setAttribute('data-globalid', globalIDAvance);
        actividadReportContainer.classList.remove('hidden-section');
    }


    /**
     * 3. Cargar Subactividades asociadas y generar secciones de reporte individuales.
     */
    async function loadSubActividadSections(actividadID, trimestre) {
        subactividadesSections.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando Subactividades asociadas...</td></tr>';
        subactividadesReportContainer.classList.remove('hidden-section'); // Mostrar el contenedor base
        btnSubmit.disabled = true; // Deshabilitar hasta que los datos estén listos

        try {
            // A. Cargar Subactividades (Layer ID 31)
            const subactivities = await queryArcGIS(subActividadLayerId, {
                where: `ActividadID = '${actividadID}'`,
                outFields: 'SubActividadID, CodigoSubAct, Nombre, UnidadMedida',
                orderByFields: 'CodigoSubAct'
            });

            if (subactivities.length === 0) {
                subactividadesSections.innerHTML = '<p class="info-message">No se encontraron Subactividades asociadas a esta Actividad.</p>';
                btnSubmit.disabled = false;
                return;
            }
            
            const subActividadIDs = subactivities.map(s => `'${s.attributes.SubActividadID}'`);
            const year = new Date().getFullYear(); 

            // B. Cargar Avances Trimestrales Previos de TODAS las subactividades (Layer ID 3)
            const avances = await queryArcGIS(avanceSubActividadTableId, {
                where: `SubActividadID IN (${subActividadIDs.join(',')}) AND Anio = ${year} AND Trimestre = '${trimestre}'`,
                outFields: 'SubActividadID, ValorEjecutado, PorcentajeAvance, GlobalID, Observaciones'
            });
            const avanceMap = new Map(avances.map(f => [f.attributes.SubActividadID, f.attributes]));
            
            // C. Generar una sección de reporte por cada SubActividad
            renderSubActivitiesSections(subactivities, avanceMap, year, trimestre);

        } catch (e) {
            subactividadesSections.innerHTML = '<p class="error-message">Error al cargar el detalle de Subactividades. Revise la consola.</p>';
            console.error("Error loadSubActividadSections:", e);
        } finally {
            btnSubmit.disabled = false;
        }
    }
    
    /**
     * 4. Renderizar las secciones HTML dinámicas de SubActividades.
     */
    function renderSubActivitiesSections(subactivities, avanceMap, year, trimestre) {
        let htmlContent = '';
        
        subactivities.forEach((feature) => {
            const attr = feature.attributes;
            const subActividadID = attr.SubActividadID;
            const avance = avanceMap.get(subActividadID);
            
            const globalIDAvance = avance ? avance.GlobalID : '';
            const valorEjecutado = avance ? avance.ValorEjecutado : '';
            const observaciones = avance ? avance.Observaciones : '';
            const porcentajeAvance = avance ? avance.PorcentajeAvance : 'XXX';
            
            // Se genera una tabla de reporte simplificada para cada subactividad
            htmlContent += `
                <div class="subactividad-section">
                    <h4>${attr.CodigoSubAct}: ${attr.Nombre} <span class="avance-badge">% avance: ${porcentajeAvance}%</span></h4>
                    
                    <table class="report-table subact-detail-table">
                        <thead>
                            <tr>
                                <th style="width: 20%;">Unidad Medida</th>
                                <th style="width: 20%;">Valor Ejecutado*</th>
                                <th style="width: 20%;">% Avance</th>
                                <th style="width: 40%;">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${attr.UnidadMedida || 'N/A'}</td>
                                <td>
                                    <input type="number" step="any" min="0" class="table-input subact-valor-ejecutado"
                                        data-id="${subActividadID}"
                                        data-globalid="${globalIDAvance}" 
                                        data-anio="${year}"
                                        data-trimestre="${trimestre}"
                                        value="${valorEjecutado || ''}"
                                        required>
                                </td>
                                <td>
                                    <input type="number" step="any" min="0" max="100" class="table-input subact-porcentaje-avance"
                                        value="${avance ? avance.PorcentajeAvance : ''}">
                                </td>
                                <td>
                                    <textarea class="table-textarea subact-observaciones">${observaciones}</textarea>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        subactividadesSections.innerHTML = htmlContent;
    }

    // 5. Lógica para enviar el reporte (Reportar Avance) a AMBAS tablas
    reporteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        btnSubmit.disabled = true;
        mostrarMensaje('Iniciando envío de avances...', 'info');

        const actividadID = selectActividad.value;
        const trimestre = selectTrimestre.value;
        const anio = new Date().getFullYear();
        
        // --- A. Reporte de Avance de Actividad (Layer ID 2) ---
        const actUpdates = [];
        const actInserts = [];
        const actGlobalID = actividadReportContainer.getAttribute('data-globalid');
        const fechaCalculo = document.getElementById('act-fecha-calculo').value;

        const actAttributes = {
            ActividadID: actividadID,
            Anio: anio,
            Trimestre: trimestre,
            ValorEjecutado: parseFloat(document.getElementById('act-valor-ejecutado').value) || 0,
            PorcentajeAvance: parseFloat(document.getElementById('act-porcentaje-avance').value) || 0,
            Observaciones: document.getElementById('act-observaciones').value,
            OrigenCarga: document.getElementById('act-origen-carga').value,
            MetodoID: generateUUID(), 
            ...(fechaCalculo && {FechaCalculo: new Date(fechaCalculo).getTime()}), 
        };

        if (actGlobalID) {
            actAttributes.GlobalID = actGlobalID;
            actUpdates.push({ attributes: actAttributes });
        } else {
             actAttributes.AvanceID = generateUUID(); 
             actInserts.push({ attributes: actAttributes });
        }
        
        const resultAct = await sendEdits(avanceActividadTableId, actInserts, actUpdates);
        
        if (!resultAct.success) {
            mostrarMensaje('Error al reportar Avance de Actividad. Deteniendo proceso.', 'error');
            console.error('Error Actividad:', resultAct.result);
            btnSubmit.disabled = false;
            return;
        }
        mostrarMensaje('Avance de Actividad reportado exitosamente.', 'info');
        
        // --- B. Reporte de Avance de SubActividades (Layer ID 3) ---
        const subActUpdates = [];
        const subActInserts = [];
        
        // Se recorre cada sección de SubActividad para obtener los datos
        document.querySelectorAll('.subactividad-section').forEach(section => {
            const inputValor = section.querySelector('.subact-valor-ejecutado');
            const inputPorcentaje = section.querySelector('.subact-porcentaje-avance');
            const textareaObs = section.querySelector('.subact-observaciones');

            const subActividadID = inputValor.dataset.id;
            const globalIDAvance = inputValor.dataset.globalid;
            const valor = parseFloat(inputValor.value) || 0;
            const porcentaje = parseFloat(inputPorcentaje.value) || 0;
            
            const subActAttributes = {
                SubActividadID: subActividadID,
                Anio: anio,
                Trimestre: trimestre,
                ValorEjecutado: valor,
                PorcentajeAvance: porcentaje,
                Observaciones: textareaObs.value,
                FechaCorte: new Date().getTime(),
                OrigenCarga: 'App',
            };

            if (globalIDAvance) {
                subActAttributes.GlobalID = globalIDAvance;
                subActUpdates.push({ attributes: subActAttributes });
            } else {
                subActAttributes.AvanceSubID = generateUUID(); 
                subActInserts.push({ attributes: subActAttributes });
            }
        });

        const resultSub = await sendEdits(avanceSubActividadTableId, subActInserts, subActUpdates);

        if (!resultSub.success) {
            mostrarMensaje('Error al reportar Avance de SubActividades.', 'error');
            console.error('Error SubActividad:', resultSub.result);
        } else {
            mostrarMensaje('Reporte completo (Actividad y Subactividades) exitoso.', 'exito');
        }
        
        loadData(actividadID, trimestre);
        btnSubmit.disabled = false;
    });
    
    /**
     * Función para enviar las ediciones a una tabla específica.
     */
    async function sendEdits(layerId, adds, updates) {
        // ... (código sendEdits se mantiene igual) ...
        if (adds.length === 0 && updates.length === 0) return { success: true, result: null };

        const applyEditsUrl = `${serviceUrl}/${layerId}/applyEdits`;
        const params = new URLSearchParams({
            f: 'json',
            adds: JSON.stringify(adds),
            updates: JSON.stringify(updates)
        });

        try {
            const response = await fetch(applyEditsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });
            const result = await response.json();
            
            const success = (result.addResults || []).every(r => r.success) && 
                            (result.updateResults || []).every(r => r.success);
            
            return { success: success, result: result };

        } catch (error) {
            console.error(`Error de red al enviar a Layer ${layerId}:`, error);
            return { success: false, result: error };
        }
    }
    
    /**
     * 6. Función maestra para cargar todos los datos al cambiar selectores.
     */
    function loadData(actividadID, trimestre) {
        if (!actividadID || !trimestre) return;
        
        // Ocultar secciones mientras se cargan
        actividadReportContainer.classList.add('hidden-section');
        subactividadesReportContainer.classList.add('hidden-section');
        subactividadesSections.innerHTML = ''; // Limpiar las secciones dinámicas

        mostrarMensaje('Cargando todos los detalles de la Actividad...', 'info');

        // 1. Cargar el reporte de Actividad (Layer ID 2)
        loadActividadReport(actividadID, trimestre);
        
        // 2. Cargar el reporte de Subactividades (Layer ID 31 -> Layer ID 3)
        loadSubActividadSections(actividadID, trimestre);
    }

    /**
     * 7. Manejo de Eventos y Mensajes de la UI
     */
    selectActividad.addEventListener('change', () => {
        document.getElementById('nombre-actividad-actual').textContent = selectActividad.options[selectActividad.selectedIndex].textContent.split(' - ')[1] || 'Nombre de la Actividad';
        loadData(selectActividad.value, selectTrimestre.value);
    });

    selectTrimestre.addEventListener('change', () => {
        loadData(selectActividad.value, selectTrimestre.value);
    });

    function mostrarMensaje(mensaje, tipo) {
        mensajeEstado.textContent = mensaje;
        mensajeEstado.className = `mensaje-estado estado-${tipo}`; 
        mensajeEstado.classList.remove('estado-oculto');
        
        if (tipo !== 'info') {
            setTimeout(() => {
                mensajeEstado.classList.add('estado-oculto');
            }, 5000);
        }
    }

    // Inicialización: Cargar actividades al cargar la página
    loadActivities();
});