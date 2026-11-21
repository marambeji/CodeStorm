/**
 * Fonds de carte de TerraCalc (tous gratuits, attribution obligatoire affichée sur la carte).
 */
export type BaseLayer = 'satellite' | 'plan' | 'historique'

export const ESRI_SATELLITE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagerie © <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
  maxNativeZoom: 19,
}

export const OSM_PLAN = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
  maxNativeZoom: 19,
}

/**
 * Sentinel-2 cloudless d'EOX : une mosaïque sans nuages par année.
 * Années vérifiées dans le catalogue WMTS d'EOX : 2016 → 2025.
 * Résolution 10 m/pixel : on voit l'évolution d'une parcelle, pas chaque arbre.
 */
export const SENTINEL_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

export function sentinelLayer(year: number) {
  const id = year === 2016 ? 's2cloudless_3857' : `s2cloudless-${year}_3857`
  return {
    url: `https://tiles.maps.eox.at/wmts/1.0.0/${id}/default/g/{z}/{y}/{x}.jpg`,
    attribution: `<a href="https://s2maps.eu">Sentinel-2 cloudless ${year}</a> par EOX IT Services GmbH (données Copernicus Sentinel ${year} modifiées)`,
    maxNativeZoom: 15,
  }
}

/** Vue par défaut d'un nouveau terrain : bassin méditerranéen / Maghreb */
export const DEFAULT_VIEW = { center: [33.5, 6] as [number, number], zoom: 5 }
