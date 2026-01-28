// București Interactive Map Component
// Uses Leaflet.js for interactive neighborhood selection

class BucurestiMap {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.geojsonLayer = null;
        this.selectedNeighborhoods = new Set();
        this.onSelectionChange = options.onSelectionChange || (() => {});
        this.maxSelections = options.maxSelections || null;
        
        this.init();
    }
    
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Map container not found:', this.containerId);
            return;
        }
        
        // Set container height
        container.style.height = '450px';
        container.style.borderRadius = '12px';
        container.style.overflow = 'hidden';
        
        // Initialize Leaflet map centered on București
        this.map = L.map(this.containerId, {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([44.4268, 26.1025], 11);
        
        // Add a light/minimal tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);
        
        // Add the GeoJSON layer with neighborhoods
        this.addNeighborhoods();
        
        // Add legend
        this.addLegend();
        
        // Add selection info
        this.addSelectionInfo();
    }
    
    addNeighborhoods() {
        if (typeof bucuresti_cartiere === 'undefined') {
            console.error('bucuresti_cartiere data not loaded');
            return;
        }
        
        this.geojsonLayer = L.geoJSON(bucuresti_cartiere, {
            style: (feature) => this.getFeatureStyle(feature, false),
            onEachFeature: (feature, layer) => {
                // Add tooltip with neighborhood name
                layer.bindTooltip(feature.properties.name, {
                    permanent: false,
                    direction: 'center',
                    className: 'neighborhood-tooltip'
                });
                
                // Add click handler
                layer.on('click', () => this.toggleNeighborhood(feature, layer));
                
                // Add hover effects
                layer.on('mouseover', () => {
                    if (!this.selectedNeighborhoods.has(feature.properties.id)) {
                        layer.setStyle({
                            fillOpacity: 0.6,
                            weight: 3
                        });
                    }
                });
                
                layer.on('mouseout', () => {
                    if (!this.selectedNeighborhoods.has(feature.properties.id)) {
                        layer.setStyle(this.getFeatureStyle(feature, false));
                    }
                });
            }
        }).addTo(this.map);
    }
    
    getFeatureStyle(feature, isSelected) {
        const sector = feature.properties.sector;
        const colors = sectorColors[sector] || { fill: '#6B7280', border: '#4B5563' };
        
        if (isSelected) {
            return {
                fillColor: colors.fill,
                fillOpacity: 0.8,
                color: '#1F2937',
                weight: 3,
                dashArray: ''
            };
        }
        
        return {
            fillColor: colors.fill,
            fillOpacity: 0.3,
            color: colors.border,
            weight: 1.5,
            dashArray: ''
        };
    }
    
    toggleNeighborhood(feature, layer) {
        const id = feature.properties.id;
        
        if (this.selectedNeighborhoods.has(id)) {
            // Deselect
            this.selectedNeighborhoods.delete(id);
            layer.setStyle(this.getFeatureStyle(feature, false));
        } else {
            // Check max selections
            if (this.maxSelections && this.selectedNeighborhoods.size >= this.maxSelections) {
                this.showMaxSelectionsWarning();
                return;
            }
            
            // Select
            this.selectedNeighborhoods.add(id);
            layer.setStyle(this.getFeatureStyle(feature, true));
        }
        
        this.updateSelectionInfo();
        this.onSelectionChange(this.getSelectedNeighborhoods());
    }
    
    showMaxSelectionsWarning() {
        const infoDiv = document.getElementById('map-selection-info');
        if (infoDiv) {
            infoDiv.classList.add('shake-animation');
            setTimeout(() => infoDiv.classList.remove('shake-animation'), 500);
        }
    }
    
    getSelectedNeighborhoods() {
        const selected = [];
        bucuresti_cartiere.features.forEach(feature => {
            if (this.selectedNeighborhoods.has(feature.properties.id)) {
                selected.push({
                    id: feature.properties.id,
                    name: feature.properties.name,
                    sector: feature.properties.sector
                });
            }
        });
        return selected;
    }
    
    setSelectedNeighborhoods(ids) {
        this.selectedNeighborhoods = new Set(ids);
        
        // Update layer styles
        if (this.geojsonLayer) {
            this.geojsonLayer.eachLayer(layer => {
                const feature = layer.feature;
                const isSelected = this.selectedNeighborhoods.has(feature.properties.id);
                layer.setStyle(this.getFeatureStyle(feature, isSelected));
            });
        }
        
        this.updateSelectionInfo();
    }
    
    clearSelection() {
        this.selectedNeighborhoods.clear();
        
        if (this.geojsonLayer) {
            this.geojsonLayer.eachLayer(layer => {
                layer.setStyle(this.getFeatureStyle(layer.feature, false));
            });
        }
        
        this.updateSelectionInfo();
        this.onSelectionChange([]);
    }
    
    addLegend() {
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'map-legend');
            div.innerHTML = `
                <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); font-size: 11px;">
                    <div style="font-weight: 600; margin-bottom: 6px;">Sectoare</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 12px; height: 12px; background: #3B82F6; border-radius: 2px;"></span>
                            <span>Sector 1</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 12px; height: 12px; background: #10B981; border-radius: 2px;"></span>
                            <span>Sector 2</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 12px; height: 12px; background: #F59E0B; border-radius: 2px;"></span>
                            <span>Sector 3</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 12px; height: 12px; background: #EF4444; border-radius: 2px;"></span>
                            <span>Sector 4</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 12px; height: 12px; background: #8B5CF6; border-radius: 2px;"></span>
                            <span>Sector 5</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 12px; height: 12px; background: #EC4899; border-radius: 2px;"></span>
                            <span>Sector 6</span>
                        </div>
                    </div>
                </div>
            `;
            return div;
        };
        
        legend.addTo(this.map);
    }
    
    addSelectionInfo() {
        const info = L.control({ position: 'topright' });
        
        info.onAdd = () => {
            const div = L.DomUtil.create('div', 'map-selection-info');
            div.id = 'map-selection-info';
            div.innerHTML = this.getSelectionInfoHTML();
            return div;
        };
        
        info.addTo(this.map);
    }
    
    getSelectionInfoHTML() {
        const count = this.selectedNeighborhoods.size;
        const maxText = this.maxSelections ? ` / max ${this.maxSelections}` : '';
        
        return `
            <div style="background: white; padding: 10px 14px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                <div style="font-weight: 600; font-size: 13px;">
                    <span style="color: ${count > 0 ? '#059669' : '#6B7280'};">${count}</span> cartier${count !== 1 ? 'e' : ''} selectat${count !== 1 ? 'e' : ''}${maxText}
                </div>
                ${count > 0 ? `<button onclick="window.bucurestiMap?.clearSelection()" style="margin-top: 6px; font-size: 11px; color: #DC2626; cursor: pointer; background: none; border: none; text-decoration: underline;">Șterge selecția</button>` : ''}
            </div>
        `;
    }
    
    updateSelectionInfo() {
        const infoDiv = document.getElementById('map-selection-info');
        if (infoDiv) {
            infoDiv.innerHTML = this.getSelectionInfoHTML();
        }
    }
    
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}

// CSS styles for the map
const mapStyles = `
    .neighborhood-tooltip {
        background: #1F2937;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .neighborhood-tooltip::before {
        border-top-color: #1F2937;
    }
    
    .shake-animation {
        animation: shake 0.5s ease-in-out;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    .leaflet-container {
        font-family: inherit;
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = mapStyles;
document.head.appendChild(styleSheet);
