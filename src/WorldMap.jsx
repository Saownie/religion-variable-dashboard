import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Plot from 'react-plotly.js';
import Papa from 'papaparse';
import {
  Globe, Activity, ShieldAlert, X, Clock, AlertCircle, TrendingUp,
  Users, Map as MapIcon, Building2, Play, Pause, ChevronLeft, ChevronRight,
  BookOpen, Sparkles, Flame, BarChart2, Plus, Layers, ArrowLeftRight, Trash2,
  Search, SlidersHorizontal
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Crosswalk: Modern Country -> Seshat NGA(s)                         */
/* ------------------------------------------------------------------ */
const modernToHistoricalMapping = {
  "Italy": "Latium", "Turkey": "Konya Plain",
  "China": ["Middle Yellow River Valley", "Southern China Hills"],
  "Iran": "Susiana", "Egypt": "Upper Egypt", "France": "Paris Basin",
  "Mexico": "Valley of Oaxaca", "Yemen": "Yemeni Coastal Plain",
  "Japan": "Kansai", "India": ["Deccan", "Garo Hills"],
  "Russia": "Lena River Valley", "Mongolia": "Orkhon Valley",
  "Uzbekistan": "Sogdiana", "Ghana": "Ghanaian Coast",
  "Mali": "Niger Inland Delta", "Peru": "Cuzco",
  "Colombia": "North Colombia",
  "Indonesia": ["Central Java", "Kapuasi Basin"],
  "Cambodia": "Cambodian Basin", "Pakistan": "Kachi Plain",
  "Iceland": "Iceland", "Papua New Guinea": "Oro PNG",
  "Micronesia": "Chuuk Islands",
  "United States": ["Big Island Hawaii", "Cahokia", "Finger Lakes"]
};

/* ------------------------------------------------------------------ */
/*  Polity metadata: PolID -> { name, wiki, blurb }                   */
/*                                                                    */
/*  Curated mapping for the polities present in the Seshat            */
/*  replication dataset. `wiki` is the Wikipedia article title used   */
/*  for fetching a lead image via the REST summary API.               */
/* ------------------------------------------------------------------ */
const polityMetadata = {
  // -------- Egypt --------
  EgBadar:  { name: "Badarian Culture",          wiki: "Badari_culture",                          blurb: "Predynastic Upper Egyptian culture, ~4400–4000 BCE." },
  EgNaqa1:  { name: "Naqada I",                  wiki: "Naqada_I",                                blurb: "Early predynastic phase along the Nile." },
  EgNaqa2:  { name: "Naqada II",                 wiki: "Naqada_II",                               blurb: "Predynastic phase with growing social complexity." },
  EgNaqa3:  { name: "Naqada III",                wiki: "Naqada_III",                              blurb: "Proto-dynastic; precursor to unified Egypt." },
  "EgDyn1*":{ name: "Early Dynastic Egypt I",    wiki: "Early_Dynastic_Period_(Egypt)",           blurb: "First Dynasty: unification under Narmer." },
  "EgDyn2*":{ name: "Early Dynastic Egypt II",   wiki: "Second_Dynasty_of_Egypt",                 blurb: "Second Dynasty consolidation." },
  EgOldK1:  { name: "Old Kingdom (Early)",       wiki: "Old_Kingdom_of_Egypt",                    blurb: "Pyramid Age, 3rd–4th Dynasties." },
  EgOldK2:  { name: "Old Kingdom (Late)",        wiki: "Old_Kingdom_of_Egypt",                    blurb: "5th–6th Dynasties; gradual decentralisation." },
  EgIntOc:  { name: "First Intermediate Period", wiki: "First_Intermediate_Period_of_Egypt",      blurb: "Fragmentation between Old and Middle Kingdoms." },
  EgMidKg:  { name: "Middle Kingdom",            wiki: "Middle_Kingdom_of_Egypt",                 blurb: "Reunification under Mentuhotep II; classical Egyptian renaissance." },
  EgThebH:  { name: "Theban Kingdom (High)",     wiki: "Seventeenth_Dynasty_of_Egypt",            blurb: "Theban resistance during the Second Intermediate Period." },
  EgThebL:  { name: "Theban Kingdom (Low)",      wiki: "Sixteenth_Dynasty_of_Egypt",              blurb: "Local Theban polity." },
  EgNKThu:  { name: "New Kingdom (Thutmoside)",  wiki: "Eighteenth_Dynasty_of_Egypt",             blurb: "18th Dynasty: Hatshepsut, Thutmose III, Akhenaten, Tutankhamun." },
  EgNKRam:  { name: "New Kingdom (Ramesside)",   wiki: "Nineteenth_Dynasty_of_Egypt",             blurb: "19th–20th Dynasties; imperial peak under Ramesses II." },
  EgRegns:  { name: "Third Intermediate Period", wiki: "Third_Intermediate_Period_of_Egypt",      blurb: "Regional kingdoms; weakening central rule." },
  EgSaite:  { name: "Saite Dynasty",             wiki: "Twenty-sixth_Dynasty_of_Egypt",           blurb: "26th Dynasty cultural revival before the Persians." },
  EgPtol1:  { name: "Ptolemaic Kingdom (Early)", wiki: "Ptolemaic_Kingdom",                       blurb: "Greek dynasty founded by Ptolemy I after Alexander." },
  EgPtol2:  { name: "Ptolemaic Kingdom (Late)",  wiki: "Ptolemaic_Kingdom",                       blurb: "Decline through Cleopatra VII." },
  EgTulIk:  { name: "Tulunid / Ikhshidid Egypt", wiki: "Tulunids",                                blurb: "Autonomous Islamic dynasties under nominal Abbasid rule." },
  EgAyyub:  { name: "Ayyubid Sultanate",         wiki: "Ayyubid_dynasty",                         blurb: "Founded by Saladin; centred on Egypt and Syria." },
  EgMamBh:  { name: "Mamluk Sultanate (Bahri)",  wiki: "Bahri_dynasty",                           blurb: "Bahri Mamluks: defeated the Mongols and Crusaders." },
  EgMamBu:  { name: "Mamluk Sultanate (Burji)",  wiki: "Burji_dynasty",                           blurb: "Circassian Mamluk dynasty until Ottoman conquest." },
  EgMamCP:  { name: "Mamluk Cairo Period",       wiki: "Mamluk_Sultanate",                        blurb: "Mamluk-era Cairo." },

  // -------- Polities that swept through Egypt --------
  IrAchae:  { name: "Achaemenid Empire",         wiki: "Achaemenid_Empire",                       blurb: "First Persian Empire under Cyrus and Darius." },
  ItRomPr:  { name: "Roman Republic",            wiki: "Roman_Republic",                          blurb: "Pre-imperial Rome." },
  TrRomDm:  { name: "Roman Empire (Dominate)",   wiki: "Roman_Empire",                            blurb: "Late Roman Empire after Diocletian's reforms." },
  "TrERom*":{ name: "Eastern Roman Empire",      wiki: "Byzantine_Empire",                        blurb: "Byzantine continuation of Rome from Constantinople." },
  SyCalUm:  { name: "Umayyad Caliphate",         wiki: "Umayyad_Caliphate",                       blurb: "First major Islamic caliphate from Damascus." },
  IqAbbs1:  { name: "Abbasid Caliphate",         wiki: "Abbasid_Caliphate",                       blurb: "Golden Age of Islam, ruled from Baghdad." },
  TnFatim:  { name: "Fatimid Caliphate",         wiki: "Fatimid_Caliphate",                       blurb: "Shi'ite caliphate that founded Cairo." },
  TrOttm3:  { name: "Ottoman Empire (Classical)",wiki: "Ottoman_Empire",                          blurb: "Süleyman-era classical Ottoman state." },
  TrOttm4:  { name: "Ottoman Empire (Late)",     wiki: "Ottoman_Empire",                          blurb: "Reform-era Ottoman state." },
  SdKusht:  { name: "Kingdom of Kush",           wiki: "Kingdom_of_Kush",                         blurb: "Nubian state south of Egypt; ruled Egypt as 25th Dynasty." },

  // -------- A few from other regions for breadth --------
  Hawaii1:  { name: "Hawaiian Kingdom (Early)",  wiki: "Ancient_Hawaii",                          blurb: "Pre-contact Hawaiian society." },
  Cahokia:  { name: "Cahokia",                   wiki: "Cahokia",                                 blurb: "Mississippian mound-building polity." }
};

/* Fallback for any PolID we haven't curated. */
const defaultPolityMeta = (polId) => ({
  name: polId,
  wiki: null,
  blurb: "Historical polity from the Seshat databank."
});

const getPolityMeta = (polId) => polityMetadata[polId] || defaultPolityMeta(polId);

/* ------------------------------------------------------------------ */
/*  Wikipedia image fetcher (LRU-capped at module scope)               */
/* ------------------------------------------------------------------ */
const WIKI_CACHE_MAX = 50;
const wikiImageCache = new Map(); // wikiTitle -> { thumb, extract } | null

function cacheGet(key) {
  if (!wikiImageCache.has(key)) return undefined;
  // Touch: move to end so it's "recently used"
  const v = wikiImageCache.get(key);
  wikiImageCache.delete(key);
  wikiImageCache.set(key, v);
  return v;
}

function cacheSet(key, value) {
  if (wikiImageCache.has(key)) wikiImageCache.delete(key);
  wikiImageCache.set(key, value);
  // Evict oldest if over cap
  while (wikiImageCache.size > WIKI_CACHE_MAX) {
    const oldest = wikiImageCache.keys().next().value;
    wikiImageCache.delete(oldest);
  }
}

async function fetchWikiSummary(wikiTitle) {
  if (!wikiTitle) return null;
  const cached = cacheGet(wikiTitle);
  if (cached !== undefined) return cached;

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
    const res = await fetch(url);
    if (!res.ok) {
      cacheSet(wikiTitle, null);
      return null;
    }
    const data = await res.json();
    const summary = {
      thumb: data.thumbnail?.source || null,
      original: data.originalimage?.source || null,
      extract: data.extract || null,
      url: data.content_urls?.desktop?.page || null
    };
    cacheSet(wikiTitle, summary);
    return summary;
  } catch {
    cacheSet(wikiTitle, null);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Historical metric configuration                                    */
/* ------------------------------------------------------------------ */
const historyMetrics = [
  { id: 'SPC1',     label: 'Complexity',     icon: TrendingUp },
  { id: 'PolPop',   label: 'Population',     icon: Users },
  { id: 'PolTerr',  label: 'Territory',      icon: MapIcon },
  { id: 'infrastr', label: 'Infrastructure', icon: Building2 }
];

/* ------------------------------------------------------------------ */
/*  STABLE GLOBE LAYOUT                                                */
/*                                                                    */
/*  Defined OUTSIDE the component so its reference never changes      */
/*  across renders. This is the core of the smoothness fix:           */
/*  Plotly.react sees an identical layout reference and skips the     */
/*  expensive geo re-projection on every data tick. The layout-level  */
/*  `transition` has been removed entirely — it was the main cause    */
/*  of the rotation jitter during timeline playback.                  */
/* ------------------------------------------------------------------ */
const GLOBE_LAYOUT = {
  uirevision: 'globe-locked',     // preserves user's rotation across data updates
  geo: {
    projection: { type: 'orthographic' },
    showocean: true, oceancolor: '#eef2f7',
    showland: true,  landcolor: '#dbe1ea',
    showcountries: true, countrycolor: '#94a3b8',
    showcoastlines: true, coastlinecolor: '#64748b', coastlinewidth: 0.4,
    bgcolor: 'transparent'
  },
  margin: { l: 0, r: 0, t: 0, b: 0 },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  dragmode: 'zoom'  // zoom on geo + orthographic = smooth rotate-on-drag
};

const GLOBE_CONFIG = { displayModeBar: false, responsive: true, scrollZoom: false };

/* ------------------------------------------------------------------ */
/*  Helper: GeoJSON polygon -> Plotly lat/lon arrays                   */
/* ------------------------------------------------------------------ */
function geojsonToLatLon(geometry) {
  const lat = [], lon = [];
  const addRing = (ring) => {
    if (lat.length > 0) { lat.push(null); lon.push(null); }
    for (const coord of ring) { lon.push(coord[0]); lat.push(coord[1]); }
  };
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(addRing);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly => poly.forEach(addRing));
  }
  return { lat, lon };
}

/* Vibrant 12-color palette for distinct polity identity colors.
   Designed for high contrast against the map background and against
   each other when polities sit side by side. Adapted from Tableau10
   and ColorBrewer Set1, shifted toward saturation. */
const BORDER_PALETTE = [
  '#E15759', // coral red
  '#4E79A7', // steel blue
  '#59A14F', // grass green
  '#F28E2B', // orange
  '#B07AA1', // mauve
  '#76B7B2', // teal
  '#EDC948', // mustard
  '#FF9DA7', // pink
  '#9C755F', // brown
  '#1F77B4', // deep blue
  '#2CA02C', // forest green
  '#D62728', // crimson
];

/* H-GRI -> sequential red color (matches the modern Pew GRI palette).
   Input: 0..10. Output: hex like '#fee5d9' (low) to '#67000d' (max). */
function hgriToColor(hgri) {
  // 7-step sequential red scale (ColorBrewer Reds 7)
  const stops = ['#fee5d9','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#67000d'];
  const t = Math.max(0, Math.min(10, hgri)) / 10;
  const idx = Math.min(stops.length - 1, Math.floor(t * stops.length));
  return stops[idx];
}

/* ------------------------------------------------------------------ */
/*  RADAR CHART CONFIGURATION                                          */
/* ------------------------------------------------------------------ */
// Each axis on the radar maps to one Seshat religious-tolerance variable.
// Labels are short (3-4 words) so they fit around the chart.
// Variables are ordered to group conceptually-related ones around the radar:
// public worship + buildings + literature + education on one side (visible
// religious practice), conversion + proselytizing + violence on another
// (active coercion), property + tax + occupation discrimination on a third
// (economic restrictions).
const RADAR_VARS = [
  { key: "Government Restrictions on Public Worship",                                                  label: "Public worship",      type: "gov" },
  { key: "Government Restrictions on Construction of Religious Buildings",                             label: "Buildings",           type: "gov" },
  { key: "Government Restrictions on Circulation of Religious Literature",                             label: "Literature",          type: "gov" },
  { key: "Government Restrictions on Religious Education",                                             label: "Education",           type: "gov" },
  { key: "Government Restrictions on Conversion",                                                      label: "Conversion",          type: "gov" },
  { key: "Government Restrictions on Public Proselytizing",                                            label: "Proselytizing",       type: "gov" },
  { key: "Government Pressure to Convert",                                                             label: "Forced conversion",   type: "gov" },
  { key: "Frequency of Governmental Violence Against Religious Groups",                                label: "Govt violence",       type: "gov" },
  { key: "Government Restrictions on Property Ownership for Adherents of Any Religious Group",         label: "Property",            type: "gov" },
  { key: "Taxes Based on Religious Adherence or on Religious Activities and Institutions",             label: "Religious tax",       type: "gov" },
  { key: "Government Discrimination Against Religious Groups Taking up Certain Occupations or Functions", label: "Govt occupation",  type: "gov" },
  { key: "Governmental Obligations for Religious Groups to Apply for Official Recognition",            label: "Recognition",         type: "gov" },
  { key: "Societal Pressure to Convert or Against Conversion",                                         label: "Social pressure",     type: "soc" },
  { key: "Frequency of Societal Violence Against Religious Groups",                                    label: "Social violence",     type: "soc" },
  { key: "Societal Discrimination Against Religious Groups Taking up Certain Occupations or Functions", label: "Social occupation",  type: "soc" },
];

/* Comparison palette — vibrant, distinct colors for overlaid radars. */
const COMPARISON_COLORS = [
  '#E15759', '#4E79A7', '#59A14F', '#F28E2B', '#B07AA1', '#76B7B2',
];

/* ------------------------------------------------------------------ */
/*  Religion family grouping for the filter panel                      */
/*                                                                    */
/*  Seshat records the dominant religion as fine-grained strings      */
/*  ("Sunni Islam", "Sufi Islam", "Vaisnavist Hinduism" etc).         */
/*  For filtering, historians want broader categories — so we map     */
/*  fine-grained values to families using keyword detection.          */
/* ------------------------------------------------------------------ */
const RELIGION_FAMILIES = [
  { id: 'islam',        label: 'Islam',                      match: /islam|muslim|sufi|caliphat/i,    color: '#10b981' },
  { id: 'christianity', label: 'Christianity',               match: /christ|catholic|orthodox|protest|coptic/i, color: '#3b82f6' },
  { id: 'hinduism',     label: 'Hinduism',                   match: /hindu|saivist|vaisnav|shakti|brahman/i, color: '#f59e0b' },
  { id: 'buddhism',     label: 'Buddhism',                   match: /buddhi|theravada|theraväda|mahayana|zen/i, color: '#f97316' },
  { id: 'judaism',      label: 'Judaism',                    match: /jew|judaism|jewish/i,             color: '#6366f1' },
  { id: 'zoroastrian',  label: 'Zoroastrianism',             match: /zoroastr|mazda/i,                 color: '#dc2626' },
  { id: 'chinese',      label: 'Chinese / East Asian',       match: /chinese popular|confucian|taoist|daoist|shinto/i, color: '#7c3aed' },
  { id: 'african',      label: 'African Indigenous',         match: /cwezi|orisha|wolof|yoruba|akan|kikuyu|bambara|mande/i, color: '#92400e' },
  { id: 'mesoamerican', label: 'Mesoamerican / Andean',      match: /mesoamerican|zapotec|aztec|maya|inca|andean/i, color: '#be123c' },
  { id: 'ancient_med',  label: 'Ancient Mediterranean',      match: /roman religion|greek|egyptian religion|mesopotamian|elamite/i, color: '#a16207' },
  { id: 'shamanism',    label: 'Shamanism / Tengrism',       match: /shaman|tengri/i,                  color: '#0891b2' },
  { id: 'other',        label: 'Other',                      match: null,                              color: '#6b7280' },
];

function classifyReligion(religionString) {
  if (!religionString) return null;
  for (const fam of RELIGION_FAMILIES) {
    if (fam.match && fam.match.test(religionString)) return fam.id;
  }
  return 'other';
}

/* ------------------------------------------------------------------ */
/*  Inject Google Fonts once                                           */
/* ------------------------------------------------------------------ */
const useGoogleFonts = () => {
  useEffect(() => {
    const id = 'gfont-fraunces-dmsans';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=DM+Sans:wght@400;500;700&display=swap';
    document.head.appendChild(link);
  }, []);
};

/* ------------------------------------------------------------------ */
/*  RadarChart — pure SVG, no Plotly                                   */
/*                                                                    */
/*  Renders one or more polity religious profiles as overlaid radars. */
/*  Inputs:                                                           */
/*    polities: [{name, color, profile: {variableName -> 0..1}}, ...] */
/*    size: pixel size of the square SVG                              */
/*    showLabels: render axis labels (false for tiny multi-grid mode) */
/* ------------------------------------------------------------------ */
function RadarChart({ polities, size = 320, showLabels = true }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * (showLabels ? 0.62 : 0.82);
  const N = RADAR_VARS.length;

  const axes = RADAR_VARS.map((v, i) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return {
      ...v, angle,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      labelX: cx + Math.cos(angle) * radius * 1.18,
      labelY: cy + Math.sin(angle) * radius * 1.18,
    };
  });

  const rings = [0.25, 0.5, 0.75, 1.0];

  const polygons = polities.map((p, idx) => {
    const points = axes.map(a => {
      const v = p.profile?.[a.key];
      const r = (typeof v === 'number') ? v * radius : 0;
      const x = cx + Math.cos(a.angle) * r;
      const y = cy + Math.sin(a.angle) * r;
      const has = typeof v === 'number';
      return { x, y, has };
    });
    return {
      ...p,
      color: p.color || COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
      points,
      pathString: points.map(pt => `${pt.x},${pt.y}`).join(' '),
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {rings.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={radius * r}
                fill="none" stroke="#e2e8f0" strokeWidth={i === rings.length - 1 ? 1 : 0.6} />
      ))}
      {axes.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y}
              stroke="#e2e8f0" strokeWidth={0.6} />
      ))}
      {polygons.map((poly, idx) => (
        <g key={idx}>
          <polygon
            points={poly.pathString}
            fill={poly.color} fillOpacity={polities.length === 1 ? 0.35 : 0.18}
            stroke={poly.color} strokeWidth={2} strokeLinejoin="round"
          />
          {poly.points.map((pt, j) =>
            pt.has ? (
              <circle key={j} cx={pt.x} cy={pt.y} r={2.5}
                      fill={poly.color} stroke="white" strokeWidth={1} />
            ) : null
          )}
        </g>
      ))}
      {showLabels && axes.map((a, i) => {
        const cosA = Math.cos(a.angle);
        const anchor = cosA > 0.2 ? 'start' : cosA < -0.2 ? 'end' : 'middle';
        const fill = a.type === 'gov' ? '#475569' : '#92400e';
        return (
          <text key={i}
                x={a.labelX} y={a.labelY}
                fontSize={9} fontWeight={600}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill={fill}>
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ================================================================== */
/*  COMPONENT                                                          */
/* ================================================================== */
const WorldMap = () => {
  useGoogleFonts();

  // ---------- state ----------
  const [pewData, setPewData] = useState([]);
  const [seshatData, setSeshatData] = useState([]);
  const [selectedYear, setSelectedYear] = useState('2022');
  const [activeIndex, setActiveIndex] = useState('GRI');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeCountry, setActiveCountry] = useState(null);
  const [activeHistoryMetric, setActiveHistoryMetric] = useState('SPC1');
  const [chartView, setChartView] = useState('coercion');   // 'coercion' | 'complexity'
  const [colorByCoercion, setColorByCoercion] = useState(true);
  const [selectedPolityId, setSelectedPolityId] = useState(null);
  const [polityImage, setPolityImage] = useState(null); // {thumb, extract, url}
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({ pew: null, seshat: null });
  const [cliopatriaData, setCliopatriaData] = useState(null);
  const [histYear, setHistYear] = useState(-500); // historical year for border map
  const [isPlayingHist, setIsPlayingHist] = useState(false);

  // Comparison shelf — list of polity entries dragged from anywhere
  // in the dashboard. Each entry stores a snapshot so we don't have
  // to re-look-up data when the active country changes.
  // { id, name, profile, hgri, hshi, mainReligion, country, startYear, endYear }
  const [comparisonShelf, setComparisonShelf] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [compareMode, setCompareMode] = useState('grid'); // 'grid' | 'overlay'

  // Filter / search drawer
  const [showFilters, setShowFilters] = useState(false);
  const [filterReligions, setFilterReligions] = useState(new Set()); // Set<famId>
  const [filterCenturyMin, setFilterCenturyMin] = useState(-30);     // -30 = 3000 BCE
  const [filterCenturyMax, setFilterCenturyMax] = useState(21);      // 21 = 2100 CE
  const [filterHgriMin, setFilterHgriMin] = useState(0);
  const [filterHgriMax, setFilterHgriMax] = useState(10);
  const [filterCountry, setFilterCountry] = useState('');            // text contains
  const [filterRequireProfile, setFilterRequireProfile] = useState(false);

  // Source transparency popover — null when closed, otherwise the
  // feature whose H-GRI breakdown is being shown.
  const [sourceFeature, setSourceFeature] = useState(null);

  // Religion spread map view
  const [globeView, setGlobeView] = useState('modern'); // 'modern' | 'spread'
  const [spreadCentury, setSpreadCentury] = useState(10); // 10 = 1000 CE
  const [spreadFocus, setSpreadFocus] = useState(null);   // null | family id (e.g. 'islam')
  const [spreadPlaying, setSpreadPlaying] = useState(false);
  const [spreadTrails, setSpreadTrails] = useState(false); // afterimage of past appearances
  const [spreadShowSuccessions, setSpreadShowSuccessions] = useState(false);
  const [clickedPolity, setClickedPolity] = useState(null); // when user clicks a polygon on spread view

  const ribbonRef = useRef(null);

  // ---------- load data ----------
  // Robust loader: tries multiple filename variants for each CSV (Papa.parse
  // with `download:true` doesn't surface 404s reliably — sometimes the
  // browser returns an HTML error page and Papa parses it as garbage rows
  // with no real columns). We validate the result against expected columns
  // before accepting it, and fall through to the next candidate on failure.
  useEffect(() => {
    const SESHAT_CANDIDATES = [
      '/mr_replication_dataset_02_2020.csv',
      '/mr_replication_dataset.02.2020.csv',
    ];
    const PEW_CANDIDATES = [
      '/PublicDataset_ReligiousRestrictions_2007to2022.csv',
    ];

    let pewDone = false, seshatDone = false;
    const tryFinish = () => { if (pewDone && seshatDone) setIsLoading(false); };

    const isValid = (rows, requiredCol) =>
      Array.isArray(rows) && rows.length > 5 && rows[0] && requiredCol in rows[0];

    const loadWithFallback = (candidates, requiredCol, label, onSuccess, onAllFailed) => {
      const attempt = (idx) => {
        if (idx >= candidates.length) { onAllFailed(); return; }
        const path = candidates[idx];
        Papa.parse(path, {
          download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
          complete: (res) => {
            if (isValid(res.data, requiredCol)) {
              console.log(`[${label}] loaded ${res.data.length} rows from ${path}`);
              onSuccess(res.data);
            } else {
              console.warn(`[${label}] ${path} returned ${res.data?.length ?? 0} rows but missing column "${requiredCol}". Trying next…`);
              attempt(idx + 1);
            }
          },
          error: (err) => {
            console.warn(`[${label}] failed to fetch ${path}: ${err.message || err}. Trying next…`);
            attempt(idx + 1);
          }
        });
      };
      attempt(0);
    };

    loadWithFallback(
      PEW_CANDIDATES, 'Ctry_EditorialName', 'Pew',
      (rows) => { setPewData(rows);    pewDone = true;    tryFinish(); },
      ()      => { setLoadErrors(e => ({ ...e, pew: PEW_CANDIDATES }));    pewDone = true;    tryFinish(); }
    );

    loadWithFallback(
      SESHAT_CANDIDATES, 'NGA', 'Seshat',
      (rows) => { setSeshatData(rows); seshatDone = true; tryFinish(); },
      ()      => { setLoadErrors(e => ({ ...e, seshat: SESHAT_CANDIDATES })); seshatDone = true; tryFinish(); }
    );
  }, []);

  // ---------- load Cliopatria border data ----------
  useEffect(() => {
    fetch('/cliopatria_web.json')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        if (data?.regions) {
          console.log(`[Cliopatria] loaded regions: ${Object.keys(data.regions).join(', ')}`);
          setCliopatriaData(data);
        }
      })
      .catch(err => console.warn('[Cliopatria] border data not available:', err.message));
  }, []);

  // ---------- modern globe data ----------
  const mapData = useMemo(() => {
    if (!pewData.length) return [];
    return pewData.filter(
      row => row.Question_Year?.toString() === selectedYear && row[activeIndex] !== null
    );
  }, [pewData, selectedYear, activeIndex]);

  const years = useMemo(() => {
    return [...new Set(pewData.map(d => d.Question_Year).filter(Boolean))]
      .sort((a, b) => a - b);
  }, [pewData]);

  // ---------- timeline player ----------
  // Slowed from 800ms to 1200ms to give the globe room to breathe between
  // data ticks; combined with the layout-transition removal this is what
  // makes rotate-while-playing actually smooth.
  useEffect(() => {
    if (!isPlaying || years.length === 0) return;
    const interval = setInterval(() => {
      setSelectedYear(currentYear => {
        const idx = years.findIndex(y => String(y) === String(currentYear));
        if (idx >= years.length - 1) {
          setIsPlaying(false);
          return currentYear;
        }
        return String(years[idx + 1]);
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, years]);

  // ---------- historical data for active country ----------
  const historicalData = useMemo(() => {
    if (!activeCountry || !seshatData.length) return null;
    const mappedNGA = modernToHistoricalMapping[activeCountry];
    if (!mappedNGA) return [];
    const targetNGAs = Array.isArray(mappedNGA) ? mappedNGA : [mappedNGA];
    return seshatData
      .filter(row => targetNGAs.includes(row.NGA))
      .sort((a, b) => a.Time - b.Time);
  }, [activeCountry, seshatData]);

  // ---------- Cliopatria border data for active country ----------
  // Moved BEFORE `polities` so the polity list can derive from it.
  const regionBorders = useMemo(() => {
    if (!activeCountry || !cliopatriaData?.regions) return null;
    return cliopatriaData.regions[activeCountry] || null;
  }, [activeCountry, cliopatriaData]);

  // ---------- polity list for the ribbon ----------
  // Primary source: regionBorders.features (Cliopatria + religion-only entries
  // from the preprocessor). Falls back to historicalData if no Cliopatria
  // data is present for this country. The Seshat NGA "MG_corr" field still
  // feeds mgEver when we can find a matching row by polity name.
  const polities = useMemo(() => {
    // Fast path: use Cliopatria/religion features if available
    if (regionBorders?.features?.length) {
      // Build a name -> MG_corr lookup from the Seshat NGA data so we
      // can flag moralizing-gods presence on Cliopatria polities too
      const mgByName = new Map();
      if (historicalData) {
        for (const row of historicalData) {
          if (row.MG_corr === 1 && row.PolID) {
            mgByName.set(row.PolID, 1);
          }
        }
      }
      return regionBorders.features.map((f, i) => ({
        id: f.seshatId || f.name || `polity-${i}`,
        name: f.name,
        startTime: f.startYear,
        endTime: f.endYear,
        mgEver: f.seshatId && mgByName.get(f.seshatId) ? 1 : 0,
        hgri: f.hgri ?? null,
        hshi: f.hshi ?? null,
        mainReligion: f.mainReligion || null,
        religionOnly: !!f.religionOnly,
      }));
    }
    // Fallback to old NGA-based logic
    if (!historicalData?.length) return [];
    const map = new Map();
    for (const row of historicalData) {
      if (!row.PolID) continue;
      if (!map.has(row.PolID)) {
        map.set(row.PolID, {
          id: row.PolID, name: row.PolID,
          startTime: row.Time, endTime: row.Time, mgEver: 0,
          hgri: null, hshi: null, mainReligion: null, religionOnly: false,
        });
      }
      const entry = map.get(row.PolID);
      entry.startTime = Math.min(entry.startTime, row.Time);
      entry.endTime   = Math.max(entry.endTime, row.Time);
      if (row.MG_corr === 1) entry.mgEver = 1;
    }
    return Array.from(map.values()).sort((a, b) => a.startTime - b.startTime);
  }, [regionBorders, historicalData]);

  const histTimeRange = useMemo(() => {
    if (!regionBorders?.features?.length) return null;
    let min = Infinity, max = -Infinity;
    for (const f of regionBorders.features) {
      if (f.startYear != null && f.startYear < min) min = f.startYear;
      if (f.endYear   != null && f.endYear   > max) max = f.endYear;
    }
    return min < Infinity ? { min, max } : null;
  }, [regionBorders]);

  // Reset histYear when country changes and set to a reasonable default
  useEffect(() => {
    if (histTimeRange) {
      setHistYear(Math.round((histTimeRange.min + histTimeRange.max) / 2));
    }
  }, [histTimeRange]);

  // Historical timeline player
  // 700ms (was 350ms) — combined with one-active-player mutex below, this
  // keeps Plotly memory churn much lower during playback.
  useEffect(() => {
    if (!isPlayingHist || !histTimeRange || !activeCountry) return;
    const step = Math.max(25, Math.round((histTimeRange.max - histTimeRange.min) / 60));
    const interval = setInterval(() => {
      setHistYear(y => {
        const next = y + step;
        if (next > histTimeRange.max) { setIsPlayingHist(false); return histTimeRange.max; }
        return next;
      });
    }, 700);
    return () => clearInterval(interval);
  }, [isPlayingHist, histTimeRange, activeCountry]);

  // Mutex: only one player runs at a time.
  // (Two simultaneous Plotly playbacks is the fastest path to a crash.)
  useEffect(() => { if (isPlayingHist) setIsPlaying(false); }, [isPlayingHist]);
  useEffect(() => { if (isPlaying)     setIsPlayingHist(false); }, [isPlaying]);

  // Auto-stop hist player when panel closes (avoids invisible churn).
  useEffect(() => { if (!activeCountry) setIsPlayingHist(false); }, [activeCountry]);

  // Pause all players when the tab is hidden — leaving Plotly playback
  // running in a background tab is a fast path to a memory crash.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setIsPlaying(false);
        setIsPlayingHist(false);
        setSpreadPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Spread-view century playback. 800ms per century — slow enough for the
  // brain to register changes, fast enough to feel cinematic. Stops at 21
  // (~2100 CE) which is past anything in the data.
  useEffect(() => {
    if (!spreadPlaying || globeView !== 'spread') return;
    const interval = setInterval(() => {
      setSpreadCentury(c => {
        if (c >= 21) { setSpreadPlaying(false); return c; }
        return c + 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [spreadPlaying, globeView]);

  // Stop spread playback when leaving spread view
  useEffect(() => { if (globeView !== 'spread') setSpreadPlaying(false); }, [globeView]);

  // Filter features to those active at histYear, capped at 12 largest.
  // Religion-only features (no geometry) are excluded from the border map
  // — they still appear in the polity ribbon and timeline.
  const MAX_BORDERS = 12;
  const activeHistBorders = useMemo(() => {
    if (!regionBorders?.features) return { shown: [], total: 0 };
    const all = regionBorders.features.filter(
      f => !f.religionOnly &&
           f.geometry &&
           f.startYear != null && f.endYear != null &&
           f.startYear <= histYear && f.endYear >= histYear
    );
    if (all.length <= MAX_BORDERS) return { shown: all, total: all.length };

    // Cheap area proxy: bbox span of the first ring
    const sized = all.map(f => {
      const ring = f.geometry.coordinates?.[0]?.[0]?.length
        ? f.geometry.coordinates[0]   // Polygon: outer ring
        : f.geometry.coordinates[0]?.[0]; // MultiPolygon: first poly outer ring
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      if (ring) {
        for (const c of ring) {
          if (c[0] < minLon) minLon = c[0];
          if (c[0] > maxLon) maxLon = c[0];
          if (c[1] < minLat) minLat = c[1];
          if (c[1] > maxLat) maxLat = c[1];
        }
      }
      return { f, area: (maxLon - minLon) * (maxLat - minLat) };
    });
    sized.sort((a, b) => b.area - a.area);
    return { shown: sized.slice(0, MAX_BORDERS).map(x => x.f), total: all.length };
  }, [regionBorders, histYear]);

  // Build Plotly scattergeo traces for the regional border map.
  // Two coloring modes:
  //   - colorByCoercion=true:  red scale by H-GRI; polities WITHOUT H-GRI
  //     get a desaturated identity color so they're still visible
  //     (instead of disappearing into uniform grey).
  //   - colorByCoercion=false: each polity gets a vibrant identity color
  //     for high contrast.
  const borderTraces = useMemo(() => {
    return activeHistBorders.shown.map((f, i) => {
      const { lat, lon } = geojsonToLatLon(f.geometry);

      let lineColor, fillAlpha;
      if (colorByCoercion) {
        if (f.hgri != null) {
          lineColor = hgriToColor(f.hgri);
          fillAlpha = 'BB';  // ~73% — H-GRI data is the focus, make it bold
        } else {
          // No H-GRI: use identity color but desaturated so it doesn't
          // compete with the H-GRI-colored polities visually
          lineColor = f.color || BORDER_PALETTE[i % BORDER_PALETTE.length];
          fillAlpha = '55';  // ~33% — visible but subordinate
        }
      } else {
        lineColor = f.color || BORDER_PALETTE[i % BORDER_PALETTE.length];
        fillAlpha = 'BB';  // bold identity colors
      }

      const hoverParts = [`<b>${f.name}</b>`];
      if (f.hgri != null) hoverParts.push(`H-GRI: ${f.hgri.toFixed(1)} (n=${f.hgriCoverage})`);
      else                hoverParts.push('H-GRI: not coded');
      if (f.mainReligion) hoverParts.push(f.mainReligion);

      return {
        type: 'scattergeo',
        mode: 'lines',
        fill: 'toself',
        lat, lon,
        line: { color: lineColor, width: 2.2 },
        fillcolor: lineColor + fillAlpha,
        name: f.name,
        text: hoverParts.join('<br>'),
        hoverinfo: 'text',
        showlegend: true
      };
    });
  }, [activeHistBorders, colorByCoercion]);

  const borderLayout = useMemo(() => {
    if (!regionBorders) return {};
    const b = regionBorders.bounds;
    const c = regionBorders.center;
    return {
      uirevision: `border-${activeCountry}`,
      geo: {
        projection: { type: 'equirectangular' },
        center: { lat: c.lat, lon: c.lon },
        lonaxis: { range: [b.west, b.east] },
        lataxis: { range: [b.south, b.north] },
        showland: true, landcolor: '#f0e8d8',
        showocean: true, oceancolor: '#d6e8f0',
        showcountries: true, countrycolor: '#b0b0b0', countrywidth: 0.5,
        showcoastlines: true, coastlinecolor: '#888', coastlinewidth: 0.5,
        bgcolor: 'transparent',
        showframe: false
      },
      margin: { l: 0, r: 0, t: 0, b: 0 },
      showlegend: true,
      legend: { orientation: 'h', y: -0.02, x: 0.5, xanchor: 'center',
                font: { size: 9, color: '#64748b' }, bgcolor: 'rgba(255,255,255,0.7)' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      autosize: true
    };
  }, [regionBorders, activeCountry]);

  // ---------- religious context summary ----------
  const religiousContext = useMemo(() => {
    if (!activeCountry) return null;
    const modernRow = pewData
      .filter(r => r.Ctry_EditorialName === activeCountry && r.Question_Year)
      .sort((a, b) => b.Question_Year - a.Question_Year)[0];

    const total = polities.length;
    const withGods = polities.filter(p => p.mgEver === 1).length;

    return {
      modernGRI: modernRow?.GRI ?? null,
      modernSHI: modernRow?.SHI ?? null,
      modernYear: modernRow?.Question_Year ?? null,
      polityCount: total,
      moralizingShare: total ? withGods / total : null
    };
  }, [activeCountry, pewData, polities]);

  // ---------- when active country changes, reset polity selection ----------
  useEffect(() => {
    if (polities.length > 0) setSelectedPolityId(polities[0].id);
    else setSelectedPolityId(null);
  }, [polities]);

  // ---------- fetch polity image when selection changes ----------
  useEffect(() => {
    if (!selectedPolityId) { setPolityImage(null); return; }

    // Prefer wiki title from the Cliopatria feature itself (covers many
    // more polities than our hand-curated polityMetadata).
    const feature = regionBorders?.features?.find(
      f => (f.seshatId === selectedPolityId) || (f.name === selectedPolityId)
    );
    const wikiTitle = feature?.wiki || getPolityMeta(selectedPolityId).wiki;

    let cancelled = false;
    setPolityImage(null);
    if (wikiTitle) {
      fetchWikiSummary(wikiTitle).then(summary => {
        if (!cancelled) setPolityImage(summary);
      });
    }
    return () => { cancelled = true; };
  }, [selectedPolityId, regionBorders]);

  // ---------- All polities index for the filter panel ----------
  // Flat list across all countries, computed ONCE when cliopatriaData loads.
  // Contains 3000+ entries so we don't re-flatten on every filter change.
  const allPolities = useMemo(() => {
    if (!cliopatriaData?.regions) return [];
    const out = [];
    for (const [country, region] of Object.entries(cliopatriaData.regions)) {
      for (const f of region.features || []) {
        // Compute a cheap representative point from the geometry's first ring
        // (used for succession bucketing and click-to-detail).
        let repLat = null, repLon = null;
        if (f.geometry?.coordinates) {
          const ring = f.geometry.type === 'Polygon'
            ? f.geometry.coordinates[0]
            : (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0]?.[0] : null);
          if (ring && ring.length > 0) {
            let sLat = 0, sLon = 0;
            for (const c of ring) { sLon += c[0]; sLat += c[1]; }
            repLon = sLon / ring.length;
            repLat = sLat / ring.length;
          }
        }
        out.push({
          ...f,
          country,
          religionFamily: classifyReligion(f.mainReligion),
          repLat, repLon,
        });
      }
    }
    return out;
  }, [cliopatriaData]);

  // ---------- Religion succession events ----------
  // A succession is: in the same ~5° geographic cell, polity B starts after
  // polity A ends, and they have different religion families. These are
  // historically the conversion moments (Zoroastrian → Islam in Persia, etc.)
  //
  // We bucket polities by lat/lon cell, sort each cell by start year, and
  // walk consecutive pairs. Result: a list of {lat, lon, fromFamily, toFamily,
  // year, fromName, toName, country} suitable for plotting as a heatmap.
  const successionEvents = useMemo(() => {
    if (!allPolities.length) return [];
    const CELL = 5; // degrees
    const buckets = new Map(); // "lat,lon" -> [polities]
    for (const p of allPolities) {
      if (p.repLat == null || p.repLon == null) continue;
      if (p.startYear == null || p.endYear == null) continue;
      if (!p.religionFamily) continue;
      const key = `${Math.floor(p.repLat / CELL)},${Math.floor(p.repLon / CELL)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(p);
    }

    const events = [];
    for (const polities of buckets.values()) {
      polities.sort((a, b) => a.startYear - b.startYear);
      for (let i = 0; i < polities.length - 1; i++) {
        for (let j = i + 1; j < polities.length; j++) {
          const a = polities[i], b = polities[j];
          // Successor must start at or after predecessor ends, but not too
          // long after (we want the *immediate* successor, not 1500 years later)
          if (b.startYear < a.endYear - 50) continue;       // too much overlap
          if (b.startYear > a.endYear + 300) break;         // too distant a gap
          if (a.religionFamily === b.religionFamily) continue; // same religion → not a succession
          // Use the predecessor's rep point as the event location
          events.push({
            lat: a.repLat, lon: a.repLon,
            fromFamily: a.religionFamily,
            toFamily: b.religionFamily,
            fromName: a.name,
            toName: b.name,
            year: b.startYear,
            country: a.country,
          });
          break; // only count the first succession per predecessor
        }
      }
    }
    return events;
  }, [allPolities]);

  // ---------- Filter results ----------
  // Cheap to recompute — single pass over allPolities with predicates.
  // Capped at 200 results for UI sanity (paginate-via-narrowing-filters
  // is the intended pattern).
  const filteredPolities = useMemo(() => {
    if (!allPolities.length) return [];
    const minYear = filterCenturyMin * 100;
    const maxYear = filterCenturyMax * 100;
    const countryQuery = filterCountry.trim().toLowerCase();
    const useReligionFilter = filterReligions.size > 0;

    const matches = [];
    for (const p of allPolities) {
      // Year overlap: polity is active during the filter window
      if (p.startYear == null || p.endYear == null) continue;
      if (p.endYear < minYear || p.startYear > maxYear) continue;

      // Religion family filter
      if (useReligionFilter) {
        if (!p.religionFamily || !filterReligions.has(p.religionFamily)) continue;
      }

      // H-GRI range filter — only filter polities that HAVE an H-GRI score;
      // unscored polities pass through unless the slider is non-default.
      if (p.hgri != null) {
        if (p.hgri < filterHgriMin || p.hgri > filterHgriMax) continue;
      } else if (filterHgriMin > 0 || filterHgriMax < 10) {
        continue; // user has narrowed the H-GRI range — exclude unscored
      }

      // Country contains-text filter
      if (countryQuery && !p.country.toLowerCase().includes(countryQuery)) continue;

      // Optional: only polities with a religiousProfile
      if (filterRequireProfile && !p.religiousProfile) continue;

      matches.push(p);
      if (matches.length >= 200) break;
    }
    return matches;
  }, [allPolities, filterReligions, filterCenturyMin, filterCenturyMax,
      filterHgriMin, filterHgriMax, filterCountry, filterRequireProfile]);

  const totalMatchesUncapped = useMemo(() => {
    // Same logic but counts everything (used to show "200 of 437" badges)
    if (!allPolities.length) return 0;
    const minYear = filterCenturyMin * 100;
    const maxYear = filterCenturyMax * 100;
    const countryQuery = filterCountry.trim().toLowerCase();
    const useReligionFilter = filterReligions.size > 0;
    let count = 0;
    for (const p of allPolities) {
      if (p.startYear == null || p.endYear == null) continue;
      if (p.endYear < minYear || p.startYear > maxYear) continue;
      if (useReligionFilter && (!p.religionFamily || !filterReligions.has(p.religionFamily))) continue;
      if (p.hgri != null) {
        if (p.hgri < filterHgriMin || p.hgri > filterHgriMax) continue;
      } else if (filterHgriMin > 0 || filterHgriMax < 10) {
        continue;
      }
      if (countryQuery && !p.country.toLowerCase().includes(countryQuery)) continue;
      if (filterRequireProfile && !p.religiousProfile) continue;
      count++;
    }
    return count;
  }, [allPolities, filterReligions, filterCenturyMin, filterCenturyMax,
      filterHgriMin, filterHgriMax, filterCountry, filterRequireProfile]);

  const resetFilters = useCallback(() => {
    setFilterReligions(new Set());
    setFilterCenturyMin(-30);
    setFilterCenturyMax(21);
    setFilterHgriMin(0);
    setFilterHgriMax(10);
    setFilterCountry('');
    setFilterRequireProfile(false);
  }, []);

  const toggleReligionFilter = useCallback((famId) => {
    setFilterReligions(prev => {
      const next = new Set(prev);
      if (next.has(famId)) next.delete(famId); else next.add(famId);
      return next;
    });
  }, []);

  // ---------- comparison shelf actions ----------
  const addToShelf = useCallback((feature, country) => {
    if (!feature) return;
    const id = feature.seshatId || feature.name;
    setComparisonShelf(prev => {
      if (prev.some(p => p.id === id)) return prev; // already there
      if (prev.length >= 6) return prev;            // max 6
      return [...prev, {
        id,
        name: feature.name,
        country,
        startYear: feature.startYear,
        endYear: feature.endYear,
        hgri: feature.hgri,
        hshi: feature.hshi,
        mainReligion: feature.mainReligion,
        officialReligion: feature.officialReligion,
        profile: feature.religiousProfile || null,
      }];
    });
  }, []);
  const removeFromShelf = useCallback((id) => {
    setComparisonShelf(prev => prev.filter(p => p.id !== id));
  }, []);
  const clearShelf = useCallback(() => setComparisonShelf([]), []);

  // ---------- click on globe ----------
  const handleGlobeClick = useCallback((data) => {
    if (!data.points || data.points.length === 0) return;
    const point = data.points[0];

    if (globeView === 'spread') {
      // Spread view: customdata holds polity id; look it up and open inspect popover
      const polityId = point.customdata;
      if (!polityId) return;
      const found = allPolities.find(p => (p.seshatId || p.name) === polityId);
      if (found) setClickedPolity(found);
    } else {
      // Modern view: customdata is country location for choropleth
      if (point.location) setActiveCountry(point.location);
    }
  }, [globeView, allPolities]);

  // ---------- globe trace (memoised on z values) ----------
  const globePlot = useMemo(() => ([{
    type: 'choropleth',
    locationmode: 'country names',
    locations: mapData.map(d => d.Ctry_EditorialName),
    z: mapData.map(d => d[activeIndex]),
    text: mapData.map(d =>
      `<b>${d.Ctry_EditorialName}</b><br>${activeIndex === 'GRI' ? 'Govt. Restrictions' : 'Social Hostilities'}: ${d[activeIndex]?.toFixed(2)}<br><i>Click for deep history</i>`
    ),
    hoverinfo: 'text',
    colorscale: activeIndex === 'GRI' ? 'Reds' : 'Oranges',
    marker: { line: { color: '#1e293b', width: 0.5 } },
    colorbar: { title: `${activeIndex} Score`, thickness: 14, len: 0.55, x: 0.95 },
    zmin: 0,
    zmax: 10
  }]), [mapData, activeIndex]);

  // ---------- Religion-spread plot for the selected century ----------
  // Renders three layers in order:
  //   1. Trails (optional): faded markers of past polities
  //   2. Active polities at current century: bold markers
  //   3. Succession heatmap (optional): stacked translucent circles
  //
  // IMPORTANT: We render polities as MARKERS (sized by polygon area), not
  // filled polygons. Plotly's orthographic + scattergeo + fill='toself' has
  // a clipping bug where polygons on the back of the sphere spill onto the
  // visible hemisphere — turning the whole globe into a single color. Markers
  // at representative points avoid this entirely and read better at globe
  // scale where individual borders are too small to distinguish anyway.
  const spreadPlot = useMemo(() => {
    if (globeView !== 'spread' || !allPolities.length) return [];
    const targetYear = spreadCentury * 100;
    const traces = [];

    // Helper: estimate polity "size" from the bbox span of its first ring,
    // used to scale marker size so big empires look bigger than city-states.
    const sizeOf = (p) => {
      if (!p.geometry?.coordinates) return 12;
      const ring = p.geometry.type === 'Polygon'
        ? p.geometry.coordinates[0]
        : (p.geometry.type === 'MultiPolygon' ? p.geometry.coordinates[0]?.[0] : null);
      if (!ring || ring.length === 0) return 12;
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      for (const c of ring) {
        if (c[0] < minLon) minLon = c[0];
        if (c[0] > maxLon) maxLon = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
      }
      const span = Math.max(maxLon - minLon, maxLat - minLat);
      // Map span (degrees) to marker size (px): 1° → 8px, 100° (continent) → 28px
      return Math.max(8, Math.min(28, 8 + Math.sqrt(span) * 2.2));
    };

    // Helper: build a marker trace from a list of polities for one religion family
    const buildTrace = (polities, fam, opacity, name, isTrail = false) => {
      const lat = [], lon = [], size = [], hover = [], custom = [];
      for (const p of polities) {
        if (p.repLat == null || p.repLon == null) continue;
        lat.push(p.repLat);
        lon.push(p.repLon);
        size.push(isTrail ? Math.max(6, sizeOf(p) * 0.6) : sizeOf(p));
        hover.push(`<b>${p.name}</b><br>${p.country}<br>${p.mainReligion || fam.label}<br>${formatYear(p.startYear)}–${formatYear(p.endYear)}<br><i>Click to inspect</i>`);
        custom.push(p.seshatId || p.name);
      }
      if (lat.length === 0) return null;
      return {
        type: 'scattergeo',
        mode: 'markers',
        lat, lon,
        marker: {
          size,
          color: fam.color,
          opacity,
          line: isTrail
            ? { color: fam.color, width: 0 }
            : { color: 'white', width: 1.2 },
          symbol: 'circle',
        },
        name,
        text: hover,
        hoverinfo: isTrail ? 'skip' : 'text',
        showlegend: !isTrail,
        customdata: custom,
      };
    };

    // === LAYER 1: Trails (afterimage of past polities) ===
    if (spreadTrails) {
      const trailWindowStart = (spreadCentury - 5) * 100;
      const trailByFamily = new Map();
      for (const p of allPolities) {
        if (!p.religionFamily) continue;
        if (p.startYear == null || p.endYear == null) continue;
        if (p.endYear >= targetYear) continue;
        if (p.endYear < trailWindowStart) continue;
        if (!trailByFamily.has(p.religionFamily)) trailByFamily.set(p.religionFamily, []);
        trailByFamily.get(p.religionFamily).push(p);
      }
      for (const [famId, polities] of trailByFamily.entries()) {
        const fam = RELIGION_FAMILIES.find(f => f.id === famId);
        if (!fam) continue;
        const op = (spreadFocus && spreadFocus !== famId) ? 0.05 : 0.20;
        const trace = buildTrace(polities, fam, op, `Trail · ${fam.label}`, true);
        if (trace) traces.push(trace);
      }
    }

    // === LAYER 2: Active polities at current century ===
    const activeByFamily = new Map();
    for (const p of allPolities) {
      if (p.startYear == null || p.endYear == null) continue;
      if (p.startYear > targetYear || p.endYear < targetYear) continue;
      const fam = p.religionFamily || 'unknown';
      if (!activeByFamily.has(fam)) activeByFamily.set(fam, []);
      activeByFamily.get(fam).push(p);
    }

    // Sort families so the focused one renders LAST (on top)
    const sortedFamilies = Array.from(activeByFamily.entries()).sort((a, b) => {
      if (spreadFocus) {
        if (a[0] === spreadFocus) return 1;
        if (b[0] === spreadFocus) return -1;
      }
      return 0;
    });

    for (const [famId, polities] of sortedFamilies) {
      const fam = RELIGION_FAMILIES.find(f => f.id === famId) || { color: '#94a3b8', label: 'Unknown', id: famId };
      let opacity;
      if (!spreadFocus) opacity = 0.85;
      else if (spreadFocus === famId) opacity = 0.95;
      else opacity = 0.20;
      const trace = buildTrace(polities, fam, opacity, `${fam.label} (${polities.length})`);
      if (trace) traces.push(trace);
    }

    // === LAYER 3: Succession heatmap ===
    // Stacked translucent circles — where many successions occurred in the
    // same region, the circles overlap and compound to a saturated red.
    // This is the actual "heatmap" effect.
    if (spreadShowSuccessions) {
      const window = 200;
      const events = successionEvents.filter(
        e => Math.abs(e.year - targetYear) <= window
      );
      if (events.length > 0) {
        // Soft heatmap halos (large, very transparent)
        traces.push({
          type: 'scattergeo',
          mode: 'markers',
          lat: events.map(e => e.lat),
          lon: events.map(e => e.lon),
          marker: {
            size: 36,
            color: '#dc2626',
            opacity: 0.18,
            line: { width: 0 },
          },
          name: 'Succession density',
          hoverinfo: 'skip',
          showlegend: false,
        });
        // Crisp event dots on top with full hover info
        traces.push({
          type: 'scattergeo',
          mode: 'markers',
          lat: events.map(e => e.lat),
          lon: events.map(e => e.lon),
          marker: {
            size: 8,
            color: '#dc2626',
            opacity: 0.95,
            line: { color: 'white', width: 1.5 },
            symbol: 'circle',
          },
          name: `↻ Succession events (${events.length})`,
          text: events.map(e => {
            const fromFam = RELIGION_FAMILIES.find(f => f.id === e.fromFamily);
            const toFam   = RELIGION_FAMILIES.find(f => f.id === e.toFamily);
            return `<b>Religious succession</b><br>${e.country} · ${formatYear(e.year)}<br>${fromFam?.label || e.fromFamily} → ${toFam?.label || e.toFamily}<br><i>${e.fromName} → ${e.toName}</i>`;
          }),
          hoverinfo: 'text',
          showlegend: true,
        });
      }
    }

    return traces;
  }, [globeView, allPolities, spreadCentury, spreadFocus, spreadTrails,
      spreadShowSuccessions, successionEvents]);

  // ---------- Focus religion stats ----------
  // For the focused family: per-century count of active polities. Used to
  // render the inline sparkline + peak/trough/current readout.
  const focusStats = useMemo(() => {
    if (!spreadFocus || !allPolities.length) return null;
    const counts = new Map(); // century -> count
    for (const p of allPolities) {
      if (p.religionFamily !== spreadFocus) continue;
      if (p.startYear == null || p.endYear == null) continue;
      const startC = Math.floor(p.startYear / 100);
      const endC   = Math.floor(p.endYear / 100);
      for (let c = startC; c <= endC; c++) {
        counts.set(c, (counts.get(c) || 0) + 1);
      }
    }
    if (counts.size === 0) return null;
    const points = Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([c, n]) => ({ century: c, count: n }));
    const peak    = points.reduce((m, p) => p.count > m.count ? p : m, points[0]);
    const total   = points.reduce((s, p) => s + p.count, 0);
    const current = counts.get(spreadCentury) || 0;
    return { points, peak, total, current };
  }, [spreadFocus, allPolities, spreadCentury]);

  // Layout for spread view — same orthographic projection but with darker
  // land and richer ocean to make colored markers pop instead of blending.
  const SPREAD_LAYOUT = useMemo(() => ({
    uirevision: 'globe-locked',
    geo: {
      projection: { type: 'orthographic' },
      showocean: true, oceancolor: '#1e293b',     // deep slate ocean
      showland: true,  landcolor: '#475569',      // mid-slate land
      showcountries: true, countrycolor: '#64748b', countrywidth: 0.4,
      showcoastlines: true, coastlinecolor: '#94a3b8', coastlinewidth: 0.3,
      bgcolor: 'transparent'
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    dragmode: 'zoom',
    showlegend: true,
    legend: {
      x: 0.02, y: 0.98, xanchor: 'left', yanchor: 'top',
      bgcolor: 'rgba(255,255,255,0.92)',
      bordercolor: '#cbd5e1', borderwidth: 1,
      font: { size: 10, color: '#334155' }
    }
  }), []);

  // ---------- chart for selected polity / all polities ----------
  const historyChart = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];
    const activeLabel = historyMetrics.find(m => m.id === activeHistoryMetric).label;

    // Background: faded line for the whole region across all polities.
    const allTrace = {
      x: historicalData.map(d => d.Time),
      y: historicalData.map(d => d[activeHistoryMetric]),
      type: 'scatter', mode: 'lines',
      line: { color: 'rgba(100, 116, 139, 0.35)', width: 1.5, shape: 'spline', smoothing: 0.8 },
      name: 'All polities (region)',
      hoverinfo: 'skip'
    };

    // Foreground: bold line for the selected polity.
    const selRows = selectedPolityId
      ? historicalData.filter(d => d.PolID === selectedPolityId)
      : [];
    const selectedMeta = selectedPolityId ? getPolityMeta(selectedPolityId) : null;
    const polityTrace = {
      x: selRows.map(d => d.Time),
      y: selRows.map(d => d[activeHistoryMetric]),
      type: 'scatter', mode: 'lines+markers',
      fill: 'tozeroy',
      fillcolor: 'rgba(79, 70, 229, 0.18)',
      line: { color: '#4f46e5', width: 3, shape: 'spline', smoothing: 1.2 },
      marker: { size: 6, color: '#4f46e5' },
      name: selectedMeta?.name || 'Selected polity',
      hovertemplate: `<b>${selectedMeta?.name || ''}</b><br>Year: %{x}<br>${activeLabel}: %{y:.2f}<extra></extra>`
    };

    // Religious overlay: diamonds where moralising gods present.
    const godsRows = historicalData.filter(d => d.MG_corr === 1);
    const godsTrace = {
      x: godsRows.map(d => d.Time),
      y: godsRows.map(d => d[activeHistoryMetric]),
      type: 'scatter', mode: 'markers',
      name: 'Moralising gods',
      marker: { symbol: 'diamond', size: 9, color: '#dc2626', line: { color: 'white', width: 1.5 }, opacity: 0.9 },
      hovertemplate: '<b>%{x}</b>: Moralising gods attested<extra></extra>'
    };

    return [allTrace, polityTrace, godsTrace];
  }, [historicalData, activeHistoryMetric, selectedPolityId]);

  // ---------- UNIFIED COERCION TIMELINE ----------
  // Combines historical H-GRI (one point per polity, at its midpoint year)
  // with modern Pew GRI (one point per survey year). Same y-axis, same scale.
  const coercionTimeline = useMemo(() => {
    const traces = [];

    // Historical: H-GRI for each polity in the region with coverage.
    if (regionBorders?.features) {
      const histPoints = regionBorders.features
        .filter(f => f.hgri != null && f.startYear != null && f.endYear != null)
        .map(f => ({
          x: Math.round((f.startYear + f.endYear) / 2),
          y: f.hgri,
          name: f.name,
          coverage: f.hgriCoverage,
          religion: f.mainReligion || ''
        }))
        // De-duplicate: same midpoint year + same name
        .filter((p, i, arr) =>
          arr.findIndex(q => q.x === p.x && q.name === p.name) === i)
        .sort((a, b) => a.x - b.x);

      if (histPoints.length > 0) {
        traces.push({
          x: histPoints.map(p => p.x),
          y: histPoints.map(p => p.y),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Historical H-GRI',
          line: { color: '#475569', width: 2, shape: 'spline', smoothing: 0.5 },
          marker: { size: 9, color: histPoints.map(p => hgriToColor(p.y)),
                    line: { color: '#475569', width: 1.2 } },
          customdata: histPoints.map(p => [p.name, p.coverage, p.religion]),
          hovertemplate:
            '<b>%{customdata[0]}</b><br>' +
            'Year: %{x}<br>H-GRI: %{y:.1f} (n=%{customdata[1]} indicators)<br>' +
            '<i>%{customdata[2]}</i><extra></extra>'
        });
      }
    }

    // Modern: Pew GRI for the active country.
    if (activeCountry && pewData.length) {
      const modernPoints = pewData
        .filter(d => d.Ctry_EditorialName === activeCountry &&
                     d.GRI != null && d.Question_Year != null)
        .map(d => ({ x: d.Question_Year, y: d.GRI }))
        .sort((a, b) => a.x - b.x);

      if (modernPoints.length > 0) {
        traces.push({
          x: modernPoints.map(p => p.x),
          y: modernPoints.map(p => p.y),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Modern Pew GRI',
          line: { color: '#dc2626', width: 3 },
          marker: { size: 7, color: '#dc2626' },
          hovertemplate: '<b>%{x}</b><br>Pew GRI: %{y:.2f}<extra></extra>'
        });
      }
    }

    return traces;
  }, [regionBorders, pewData, activeCountry]);

  /* ============================================================== */
  /*  RENDER                                                         */
  /* ============================================================== */
  const isPanelOpen = !!activeCountry;
  const selectedPolity = polities.find(p => p.id === selectedPolityId) || null;
  // Build selectedMeta: prefer curated metadata, but always fall back to
  // whatever name/blurb we have on the selected polity itself. This makes
  // the card render for any polity, not just the ~30 we hand-curated.
  const selectedMeta = useMemo(() => {
    if (!selectedPolity) return null;
    const curated = getPolityMeta(selectedPolity.id);
    return {
      name: selectedPolity.name || curated.name,
      wiki: curated.wiki,  // falls back to feature.wiki via the fetch effect
      blurb: curated.blurb,
    };
  }, [selectedPolity]);

  return (
    <div
      className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ============ LEFT SIDEBAR ============ */}
      <aside className="w-96 bg-white border-r border-slate-200 p-8 flex flex-col h-full shadow-lg z-10">
        <div className="mb-10">
          <h1
            className="text-3xl tracking-tight text-slate-900 flex items-center mb-1"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}
          >
            <Globe className="w-7 h-7 mr-3 text-indigo-600" />
            Global Explorer
          </h1>
          <p className="text-xs text-slate-500 ml-10 -mt-1 italic">
            Religion · Power · Time
          </p>
        </div>

        <div className="space-y-8 flex-grow">
          {/* Globe view mode */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-3 uppercase tracking-widest">
              Globe view
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setGlobeView('modern')}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                  globeView === 'modern'
                    ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Globe className={`w-5 h-5 mb-2 ${globeView === 'modern' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className={`text-xs font-bold ${globeView === 'modern' ? 'text-indigo-700' : 'text-slate-500'}`}>
                  Modern Pew
                </span>
              </button>
              <button
                onClick={() => setGlobeView('spread')}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                  globeView === 'spread'
                    ? 'bg-violet-50 border-violet-200 ring-1 ring-violet-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Layers className={`w-5 h-5 mb-2 ${globeView === 'spread' ? 'text-violet-600' : 'text-slate-400'}`} />
                <span className={`text-xs font-bold ${globeView === 'spread' ? 'text-violet-700' : 'text-slate-500'}`}>
                  Religion spread
                </span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic leading-relaxed">
              {globeView === 'modern'
                ? 'Today\'s religious-restrictions index by country. Click a country for deep history.'
                : 'Polities active in the chosen century, colored by dominant religion family.'}
            </p>
          </div>

          {globeView === 'modern' && (<div>
            <label className="block text-xs font-bold text-slate-700 mb-3 uppercase tracking-widest">
              Active Modern Metric
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveIndex('GRI')}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                  activeIndex === 'GRI'
                    ? 'bg-red-50 border-red-200 ring-1 ring-red-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className={`w-5 h-5 mb-2 ${activeIndex === 'GRI' ? 'text-red-600' : 'text-slate-400'}`} />
                <span className={`text-xs font-bold ${activeIndex === 'GRI' ? 'text-red-700' : 'text-slate-500'}`}>
                  GRI (Govt)
                </span>
              </button>
              <button
                onClick={() => setActiveIndex('SHI')}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                  activeIndex === 'SHI'
                    ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-500'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Activity className={`w-5 h-5 mb-2 ${activeIndex === 'SHI' ? 'text-orange-600' : 'text-slate-400'}`} />
                <span className={`text-xs font-bold ${activeIndex === 'SHI' ? 'text-orange-700' : 'text-slate-500'}`}>
                  SHI (Social)
                </span>
              </button>
            </div>
          </div>)}

          {globeView === 'spread' && (<div className="space-y-5">
            {/* Century slider with play button */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-3 uppercase tracking-widest">
                Century
              </label>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => {
                    if (!spreadPlaying && spreadCentury >= 21) setSpreadCentury(-30);
                    setSpreadPlaying(!spreadPlaying);
                  }}
                  className={`p-2.5 rounded-full flex-shrink-0 transition-all ${
                    spreadPlaying
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                  }`}
                  title={spreadPlaying ? 'Pause' : 'Play through centuries'}
                >
                  {spreadPlaying
                    ? <Pause className="w-4 h-4 fill-current" />
                    : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl text-violet-700"
                        style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}>
                    {formatYear(spreadCentury * 100)}
                  </span>
                </div>
              </div>
              <input type="range" min={-30} max={21} step={1}
                     value={spreadCentury}
                     onChange={(e) => { setSpreadPlaying(false); setSpreadCentury(Number(e.target.value)); }}
                     className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600" />
              <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                <span>3000 BCE</span>
                <span>2100 CE</span>
              </div>
            </div>

            {/* Focus on a religion */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-widest">
                Focus on
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSpreadFocus(null)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border transition-all ${
                    !spreadFocus
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  All
                </button>
                {RELIGION_FAMILIES.filter(f => f.id !== 'other').map(fam => {
                  const active = spreadFocus === fam.id;
                  return (
                    <button
                      key={fam.id}
                      onClick={() => setSpreadFocus(active ? null : fam.id)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border transition-all ${
                        active ? 'text-white shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                      style={active ? { backgroundColor: fam.color, borderColor: fam.color } : {}}
                    >
                      {fam.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggles for trails and successions */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 hover:text-slate-900">
                <input type="checkbox"
                       checked={spreadTrails}
                       onChange={(e) => setSpreadTrails(e.target.checked)}
                       className="accent-violet-600" />
                <span className="flex-1">
                  <span className="font-bold">Trails</span>
                  <span className="text-[10px] text-slate-400 ml-2">previous 5 centuries faded</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 hover:text-slate-900">
                <input type="checkbox"
                       checked={spreadShowSuccessions}
                       onChange={(e) => setSpreadShowSuccessions(e.target.checked)}
                       className="accent-rose-600" />
                <span className="flex-1">
                  <span className="font-bold">Religious successions</span>
                  <span className="text-[10px] text-slate-400 ml-2">★ conversion events</span>
                </span>
              </label>
            </div>

            {/* Focus stats panel */}
            {spreadFocus && focusStats && (() => {
              const fam = RELIGION_FAMILIES.find(f => f.id === spreadFocus);
              const yMin = focusStats.points[0].century;
              const yMax = focusStats.points[focusStats.points.length - 1].century;
              const cMax = focusStats.peak.count;
              const sparkW = 240, sparkH = 50;
              const xScale = c => ((c - yMin) / Math.max(1, yMax - yMin)) * sparkW;
              const yScale = n => sparkH - (n / cMax) * sparkH;
              const path = focusStats.points
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.century).toFixed(1)},${yScale(p.count).toFixed(1)}`)
                .join(' ');
              const fillPath = path + ` L${xScale(yMax).toFixed(1)},${sparkH} L${xScale(yMin).toFixed(1)},${sparkH} Z`;
              return (
                <div className="rounded-xl p-3 border" style={{ borderColor: fam.color + '55', backgroundColor: fam.color + '0F' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold" style={{ color: fam.color, fontFamily: "'Fraunces', serif" }}>
                      {fam.label}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {formatYear(yMin * 100)} – {formatYear(yMax * 100)}
                    </span>
                  </div>
                  {/* Sparkline */}
                  <svg viewBox={`0 0 ${sparkW} ${sparkH}`} width="100%" height={sparkH} preserveAspectRatio="none"
                       style={{ display: 'block' }}>
                    <path d={fillPath} fill={fam.color} fillOpacity={0.15} />
                    <path d={path} fill="none" stroke={fam.color} strokeWidth={1.4} />
                    {/* Peak marker */}
                    <circle cx={xScale(focusStats.peak.century)} cy={yScale(focusStats.peak.count)}
                            r={3.5} fill={fam.color} stroke="white" strokeWidth={1.2} />
                    {/* Current-century marker */}
                    {spreadCentury >= yMin && spreadCentury <= yMax && (
                      <line x1={xScale(spreadCentury)} y1={0}
                            x2={xScale(spreadCentury)} y2={sparkH}
                            stroke="#0f172a" strokeWidth={1} strokeDasharray="2,2" />
                    )}
                  </svg>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                    <button
                      onClick={() => setSpreadCentury(focusStats.peak.century)}
                      className="text-left hover:bg-white/60 rounded px-1 py-0.5"
                      title="Snap to peak century"
                    >
                      <div className="uppercase tracking-wider text-slate-500">Peak</div>
                      <div className="font-bold text-slate-800">
                        {formatYear(focusStats.peak.century * 100)} <span className="text-slate-500">·</span> {focusStats.peak.count}
                      </div>
                    </button>
                    <div>
                      <div className="uppercase tracking-wider text-slate-500">Now</div>
                      <div className="font-bold text-slate-800">{focusStats.current}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-slate-500">Total</div>
                      <div className="font-bold text-slate-800">{focusStats.total}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>)}

          {globeView === 'modern' && (<div>
            <label className="block text-xs font-bold text-slate-700 mb-3 uppercase tracking-widest">
              Observation Year
            </label>
            <select
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              value={selectedYear}
              onChange={(e) => { setIsPlaying(false); setSelectedYear(e.target.value); }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>)}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700">Tip:</span> click any country
              on the globe to open its <em>Deep History</em> panel — see the polities
              that rose and fell there, and how religious authority evolved.
            </p>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 leading-relaxed pt-4 border-t border-slate-100">
          Modern data: Pew Research <span className="whitespace-nowrap">2007–2022</span>.<br/>
          Historical data: Seshat / Whitehouse et&nbsp;al. (2019).<br/>
          Polity images: Wikipedia REST API.
        </div>
      </aside>

      {/* ============ MAIN GLOBE AREA ============ */}
      <main className="flex-1 relative flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-100/60 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600 font-bold">Loading datasets…</p>
            </div>
          </div>
        )}

        {!isLoading && (loadErrors.pew || loadErrors.seshat) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-xl w-[95%]">
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <div className="font-bold mb-1">Couldn't load some data files.</div>
                  {loadErrors.seshat && (
                    <div className="mb-1">
                      <span className="font-semibold">Seshat (deep history):</span>{' '}
                      tried <code className="text-xs bg-white/70 px-1 rounded">{loadErrors.seshat.join(', ')}</code>
                    </div>
                  )}
                  {loadErrors.pew && (
                    <div className="mb-1">
                      <span className="font-semibold">Pew (modern):</span>{' '}
                      tried <code className="text-xs bg-white/70 px-1 rounded">{loadErrors.pew.join(', ')}</code>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-rose-800/80">
                    Make sure both CSVs are in your <code className="bg-white/70 px-1 rounded">public/</code> folder
                    (not <code className="bg-white/70 px-1 rounded">src/</code>) and named exactly as listed above.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-full pb-24">
          <Plot
            data={globeView === 'spread' ? spreadPlot : globePlot}
            layout={globeView === 'spread' ? SPREAD_LAYOUT : GLOBE_LAYOUT}
            onClick={handleGlobeClick}
            style={{ width: '100%', height: '100%' }}
            config={GLOBE_CONFIG}
            useResizeHandler
          />
        </div>

        {/* Floating timeline player */}
        {!isLoading && years.length > 0 && globeView === 'modern' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-10 pointer-events-none">
            <div className="bg-white/85 backdrop-blur-md border border-white/60 shadow-xl rounded-2xl p-4 pointer-events-auto flex items-center gap-6">
              <button
                onClick={() => {
                  if (!isPlaying && String(selectedYear) === String(years[years.length - 1])) {
                    setSelectedYear(String(years[0]));
                  }
                  setIsPlaying(!isPlaying);
                }}
                className={`p-3 rounded-full flex items-center justify-center transition-all ${
                  isPlaying
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                }`}
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
              </button>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 px-1">
                  <span>{years[0]}</span>
                  <span
                    className="text-lg text-indigo-700"
                    style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}
                  >
                    {selectedYear}
                  </span>
                  <span>{years[years.length - 1]}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={years.length - 1}
                  value={Math.max(0, years.findIndex(y => String(y) === String(selectedYear)))}
                  onChange={(e) => { setIsPlaying(false); setSelectedYear(String(years[e.target.value])); }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* Floating "Find polities" button */}
        {!isLoading && allPolities.length > 0 && (
          <button
            onClick={() => setShowFilters(true)}
            className="absolute top-6 right-6 z-30 bg-white/95 backdrop-blur-sm hover:bg-white border border-slate-200 shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-700 hover:text-violet-700 transition-colors"
            title="Search and filter all polities"
          >
            <Search className="w-3.5 h-3.5" />
            Find polities
          </button>
        )}
      </main>

      {/* ============================================================ */}
      {/*  FILTER DRAWER — slide-in from the right                      */}
      {/* ============================================================ */}
      <div
        className={`absolute top-0 right-0 h-full w-[460px] bg-white shadow-2xl border-l border-slate-200
                    transform transition-transform duration-300 ease-out z-[55]
                    ${showFilters ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {showFilters && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2
                  className="text-2xl text-slate-900 flex items-center gap-2"
                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}
                >
                  <SlidersHorizontal className="w-5 h-5 text-violet-600" />
                  Find polities
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Search across {allPolities.length.toLocaleString()} polities
                </p>
              </div>
              <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 space-y-5 border-b border-slate-100 overflow-y-auto" style={{ maxHeight: '60%' }}>
              {/* Religion family multi-select */}
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Religion family</label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {RELIGION_FAMILIES.map(fam => {
                    const active = filterReligions.has(fam.id);
                    return (
                      <button
                        key={fam.id}
                        onClick={() => toggleReligionFilter(fam.id)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${
                          active ? 'text-white shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                        style={active ? { backgroundColor: fam.color, borderColor: fam.color } : {}}
                      >
                        {fam.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Century range */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Time window</label>
                  <span className="text-xs font-bold text-slate-700"
                        style={{ fontFamily: "'Fraunces', serif" }}>
                    {formatYear(filterCenturyMin * 100)} → {formatYear(filterCenturyMax * 100)}
                  </span>
                </div>
                <div className="space-y-2 mt-2">
                  <div>
                    <input type="range" min={-30} max={21} step={1}
                           value={filterCenturyMin}
                           onChange={(e) => setFilterCenturyMin(Math.min(Number(e.target.value), filterCenturyMax))}
                           className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600" />
                    <div className="text-[10px] text-slate-400">From {formatYear(filterCenturyMin * 100)}</div>
                  </div>
                  <div>
                    <input type="range" min={-30} max={21} step={1}
                           value={filterCenturyMax}
                           onChange={(e) => setFilterCenturyMax(Math.max(Number(e.target.value), filterCenturyMin))}
                           className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600" />
                    <div className="text-[10px] text-slate-400">To {formatYear(filterCenturyMax * 100)}</div>
                  </div>
                </div>
              </div>

              {/* H-GRI range */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">H-GRI range</label>
                  <span className="text-xs font-bold text-slate-700"
                        style={{ fontFamily: "'Fraunces', serif" }}>
                    {filterHgriMin.toFixed(1)} – {filterHgriMax.toFixed(1)}
                  </span>
                </div>
                <div className="space-y-2 mt-2">
                  <input type="range" min={0} max={10} step={0.5}
                         value={filterHgriMin}
                         onChange={(e) => setFilterHgriMin(Math.min(Number(e.target.value), filterHgriMax))}
                         className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
                  <input type="range" min={0} max={10} step={0.5}
                         value={filterHgriMax}
                         onChange={(e) => setFilterHgriMax(Math.max(Number(e.target.value), filterHgriMin))}
                         className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Polities without coded H-GRI are {(filterHgriMin > 0 || filterHgriMax < 10) ? 'excluded' : 'included'}.
                </p>
              </div>

              {/* Country contains */}
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Country contains</label>
                <input type="text"
                       value={filterCountry}
                       onChange={(e) => setFilterCountry(e.target.value)}
                       placeholder="e.g. Egypt, China, ..."
                       className="w-full mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
              </div>

              {/* Require profile */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                <input type="checkbox"
                       checked={filterRequireProfile}
                       onChange={(e) => setFilterRequireProfile(e.target.checked)}
                       className="accent-violet-600" />
                <span>Only show polities with full religious profile (radar-ready)</span>
              </label>

              {/* Reset */}
              <button
                onClick={resetFilters}
                className="w-full text-xs px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200"
              >
                Reset all filters
              </button>
            </div>

            {/* Results */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                {totalMatchesUncapped === 0 ? 'No matches' :
                 totalMatchesUncapped <= 200 ? `${totalMatchesUncapped} matches` :
                 `Showing 200 of ${totalMatchesUncapped}`}
              </span>
              <span className="text-[10px] text-slate-400 italic">
                Click ⊕ to add to comparison
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {filteredPolities.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-sm">
                  No polities match your filters.<br />
                  Try widening the time window or H-GRI range.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredPolities.map(p => {
                    const fam = RELIGION_FAMILIES.find(f => f.id === p.religionFamily);
                    const onShelf = comparisonShelf.some(s => s.id === (p.seshatId || p.name));
                    const id = p.seshatId || p.name;
                    return (
                      <div
                        key={id + p.country}
                        className="px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{p.country}</span>
                            <span>·</span>
                            <span>{formatYear(p.startYear)} → {formatYear(p.endYear)}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {p.hgri != null && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                                    style={{ backgroundColor: hgriToColor(p.hgri) }}>
                                H-GRI {p.hgri.toFixed(1)}
                              </span>
                            )}
                            {fam && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: fam.color + '22', color: fam.color }}>
                                {fam.label}
                              </span>
                            )}
                            {p.religiousProfile && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                                ◉ profile
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => onShelf
                            ? removeFromShelf(id)
                            : addToShelf(p, p.country)}
                          disabled={!onShelf && comparisonShelf.length >= 6}
                          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            onShelf
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-30 disabled:cursor-not-allowed'
                          }`}
                          title={onShelf ? 'Remove from shelf' : 'Add to comparison shelf'}
                        >
                          {onShelf ? '✓' : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============ RIGHT PANEL: DEEP HISTORY ============ */}
      <div
        className={`absolute top-0 right-0 h-full w-[640px] bg-white shadow-2xl border-l border-slate-200
                    transform transition-transform duration-500 ease-in-out z-50
                    ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {isPanelOpen && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2
                  className="text-3xl text-slate-900"
                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}
                >
                  {activeCountry}
                </h2>
                <p className="text-indigo-600 font-semibold text-xs flex items-center mt-1 uppercase tracking-widest">
                  <Clock className="w-3 h-3 mr-1.5" />
                  Deep History · Seshat
                </p>
              </div>
              <button
                onClick={() => setActiveCountry(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-grow">
              {polities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-60 px-8">
                  <AlertCircle className="w-12 h-12 mb-4 text-slate-400" />
                  <h3 className="font-bold text-slate-600">No coded polities for this country</h3>
                  <p className="text-sm text-slate-400 mt-2">
                    The Seshat databank doesn't currently include polity records for {activeCountry}.
                    This is a coverage gap, not a defect — many regions and time periods aren't yet coded.
                  </p>
                </div>
              ) : (
                <>
                  {/* Religious context card */}
                  {religiousContext && (
                    <div className="mx-6 mt-6 p-5 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-rose-50 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest font-bold text-indigo-700">
                        <Sparkles className="w-3.5 h-3.5" />
                        Religious dimension
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Modern GRI</div>
                          <div
                            className="text-2xl text-rose-700"
                            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}
                          >
                            {religiousContext.modernGRI != null ? religiousContext.modernGRI.toFixed(1) : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">{religiousContext.modernYear || ''}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Modern SHI</div>
                          <div
                            className="text-2xl text-orange-700"
                            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}
                          >
                            {religiousContext.modernSHI != null ? religiousContext.modernSHI.toFixed(1) : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">{religiousContext.modernYear || ''}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Moralising gods</div>
                          <div
                            className="text-2xl text-indigo-700"
                            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}
                          >
                            {religiousContext.moralizingShare != null
                              ? `${Math.round(religiousContext.moralizingShare * 100)}%`
                              : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            of {religiousContext.polityCount} polities
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Regional border map (Cliopatria) ── */}
                  {regionBorders && histTimeRange && (
                    <div className="mx-6 mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs uppercase tracking-widest font-bold text-slate-700 flex items-center gap-1.5">
                          <MapIcon className="w-3.5 h-3.5 text-indigo-500" />
                          Polity borders · {formatYear(histYear)}
                        </h3>
                        <span className="text-[10px] text-slate-400">
                          {activeHistBorders.total > activeHistBorders.shown.length
                            ? `${activeHistBorders.shown.length} of ${activeHistBorders.total}`
                            : `${activeHistBorders.total} polities`}
                        </span>
                      </div>

                      {/* Color-by toggle */}
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                          Color by
                        </span>
                        <div className="flex bg-slate-100 rounded-md p-0.5">
                          <button
                            onClick={() => setColorByCoercion(true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              colorByCoercion
                                ? 'bg-white text-rose-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            H-GRI
                          </button>
                          <button
                            onClick={() => setColorByCoercion(false)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              !colorByCoercion
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Polity
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-inner bg-white">
                        <div className="h-[280px]">
                          <Plot
                            data={borderTraces}
                            layout={borderLayout}
                            style={{ width: '100%', height: '100%' }}
                            config={{ displayModeBar: false, responsive: true }}
                            useResizeHandler
                          />
                        </div>

                        {/* Historical timeline slider */}
                        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                if (!isPlayingHist && histYear >= histTimeRange.max) {
                                  setHistYear(histTimeRange.min);
                                }
                                setIsPlayingHist(!isPlayingHist);
                              }}
                              className={`p-1.5 rounded-full flex-shrink-0 transition-all ${
                                isPlayingHist
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {isPlayingHist
                                ? <Pause className="w-3.5 h-3.5 fill-current" />
                                : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                            </button>
                            <div className="flex-1">
                              <input
                                type="range"
                                min={histTimeRange.min}
                                max={histTimeRange.max}
                                step={25}
                                value={histYear}
                                onChange={(e) => { setIsPlayingHist(false); setHistYear(Number(e.target.value)); }}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-0.5 px-0.5">
                                <span>{formatYear(histTimeRange.min)}</span>
                                <span
                                  className="text-indigo-700 text-xs"
                                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}
                                >
                                  {formatYear(histYear)}
                                </span>
                                <span>{formatYear(histTimeRange.max)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Polity ribbon */}
                  <div className="mt-6">
                    <div className="px-6 flex items-center justify-between mb-3">
                      <h3 className="text-xs uppercase tracking-widest font-bold text-slate-700">
                        Civilisational evolution · {polities.length} polities
                      </h3>
                      <div className="flex gap-1">
                        <button
                          onClick={() => ribbonRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => ribbonRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={ribbonRef}
                      className="flex gap-3 overflow-x-auto px-6 pb-3 scroll-smooth"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {polities.map((p) => {
                        const meta = getPolityMeta(p.id);
                        const isActive = p.id === selectedPolityId;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPolityId(p.id)}
                            className={`flex-shrink-0 w-44 text-left rounded-xl border transition-all ${
                              isActive
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg scale-[1.02]'
                                : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300 hover:shadow-md'
                            }`}
                          >
                            <div className={`px-3 pt-3 pb-2 text-[10px] uppercase tracking-widest font-bold flex items-center justify-between ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                              <span>
                                {formatYear(p.startTime)} → {formatYear(p.endTime)}
                              </span>
                              {p.mgEver === 1 && (
                                <span title="Moralising gods attested" className={`${isActive ? 'text-rose-200' : 'text-rose-500'}`}>✦</span>
                              )}
                            </div>
                            <div
                              className="px-3 pb-3 text-sm leading-tight"
                              style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}
                            >
                              {meta.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected polity detail */}
                  {selectedPolity && selectedMeta && (
                    <div className="mx-6 mt-4 mb-6 rounded-2xl border border-slate-200 overflow-hidden bg-white">
                      <div className="flex">
                        <div className="w-44 h-44 flex-shrink-0 bg-slate-100 flex items-center justify-center overflow-hidden">
                          {polityImage?.thumb ? (
                            <img
                              src={polityImage.thumb}
                              alt={selectedMeta.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-slate-300 flex flex-col items-center text-center px-2">
                              <BookOpen className="w-8 h-8 mb-2" />
                              <div className="text-[10px] uppercase tracking-widest">No image available</div>
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                            {formatYear(selectedPolity.startTime)} → {formatYear(selectedPolity.endTime)}
                          </div>
                          <div
                            className="text-xl text-slate-900 mb-2 leading-tight"
                            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}
                          >
                            {selectedMeta.name}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">
                            {polityImage?.extract || selectedMeta.blurb}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(() => {
                              // Find the polity's H-GRI from the regionBorders feature whose name matches.
                              // Cliopatria features carry hgri/mainReligion since the merge step.
                              const matchingFeature = regionBorders?.features?.find(
                                f => f.name === selectedMeta.name ||
                                     f.seshatId === selectedPolity.id
                              );
                              const hgri = matchingFeature?.hgri;
                              const religion = matchingFeature?.mainReligion;
                              return (
                                <>
                                  {hgri != null && (
                                    <button
                                      onClick={() => setSourceFeature(matchingFeature)}
                                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white hover:ring-2 hover:ring-offset-1 hover:ring-slate-400 transition-all cursor-pointer"
                                      style={{ backgroundColor: hgriToColor(hgri) }}
                                      title="Click to see how this score was calculated"
                                    >
                                      H-GRI {hgri.toFixed(1)} ⓘ
                                    </button>
                                  )}
                                  {religion && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                      {religion}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            {selectedPolity.mgEver === 1 ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                ✦ Moralising gods attested
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                No moralising gods
                              </span>
                            )}
                            {polityImage?.url && (
                              <a
                                href={polityImage.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                              >
                                Wikipedia ↗
                              </a>
                            )}
                            {(() => {
                              const matchingFeature = regionBorders?.features?.find(
                                f => f.name === selectedMeta.name || f.seshatId === selectedPolity.id
                              );
                              const onShelf = comparisonShelf.some(p => p.id === (matchingFeature?.seshatId || matchingFeature?.name));
                              return matchingFeature ? (
                                <button
                                  onClick={() => onShelf
                                    ? removeFromShelf(matchingFeature.seshatId || matchingFeature.name)
                                    : addToShelf(matchingFeature, activeCountry)}
                                  disabled={!onShelf && comparisonShelf.length >= 6}
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                                    onShelf
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                      : 'bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-40 disabled:cursor-not-allowed'
                                  }`}
                                  title={onShelf ? 'Remove from comparison' : 'Add to comparison shelf'}
                                >
                                  {onShelf ? '✓ ON SHELF' : <><Plus className="w-2.5 h-2.5" /> COMPARE</>}
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Chart section: coercion timeline OR complexity ── */}
                  <div className="px-6 pb-8 space-y-3">
                    {/* View toggle */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-widest font-bold text-slate-700">
                        {chartView === 'coercion'
                          ? 'Religious coercion · 3000 yr timeline'
                          : 'Social complexity'}
                      </h3>
                      <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button
                          onClick={() => setChartView('coercion')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            chartView === 'coercion'
                              ? 'bg-white text-rose-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <Flame className="w-3 h-3" /> Coercion
                        </button>
                        <button
                          onClick={() => setChartView('complexity')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            chartView === 'complexity'
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <BarChart2 className="w-3 h-3" /> Complexity
                        </button>
                      </div>
                    </div>

                    {chartView === 'coercion' ? (
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Historical H-GRI from Seshat religious-tolerance variables (mean of present/absent
                        across 12 government-restriction indicators, 0–10 scale).
                        Modern Pew GRI continues the same scale for 2007–2022.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {historyMetrics.map(metric => {
                          const Icon = metric.icon;
                          const active = activeHistoryMetric === metric.id;
                          return (
                            <button
                              key={metric.id}
                              onClick={() => setActiveHistoryMetric(metric.id)}
                              className={`flex flex-col items-center p-2 rounded-lg border text-xs font-medium transition-colors ${
                                active
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <Icon className={`w-4 h-4 mb-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                              {metric.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="h-[320px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                      {chartView === 'coercion' ? (
                        coercionTimeline.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-8">
                            <Flame className="w-8 h-8 mb-2" />
                            <p className="text-xs">No religious-tolerance data is coded for polities in this region.</p>
                          </div>
                        ) : (
                          <Plot
                            data={coercionTimeline}
                            layout={{
                              margin: { l: 50, r: 20, t: 30, b: 40 },
                              xaxis: { title: 'Year (BCE/CE)', gridcolor: '#f1f5f9', zerolinecolor: '#cbd5e1' },
                              yaxis: { title: 'Govt restrictions on religion (0–10)', gridcolor: '#f1f5f9', range: [-0.3, 10.3] },
                              legend: { orientation: 'h', y: 1.12, x: 0, font: { size: 10, color: '#64748b' } },
                              plot_bgcolor: 'transparent',
                              paper_bgcolor: 'transparent',
                              autosize: true,
                              hovermode: 'closest',
                              shapes: [
                                // Subtle horizontal band at "high restriction" zone
                                { type: 'rect', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: 7, y1: 10,
                                  fillcolor: 'rgba(220, 38, 38, 0.04)', line: { width: 0 } }
                              ]
                            }}
                            style={{ width: '100%', height: '100%' }}
                            config={{ displayModeBar: false, responsive: true }}
                            useResizeHandler
                          />
                        )
                      ) : (
                        <Plot
                          data={historyChart}
                          layout={{
                            margin: { l: 50, r: 20, t: 30, b: 40 },
                            xaxis: { title: 'Year (BCE/CE)', gridcolor: '#f1f5f9', zerolinecolor: '#cbd5e1' },
                            yaxis: {
                              title: historyMetrics.find(m => m.id === activeHistoryMetric).label,
                              gridcolor: '#f1f5f9'
                            },
                            legend: { orientation: 'h', y: 1.12, x: 0, font: { size: 10, color: '#64748b' } },
                            plot_bgcolor: 'transparent',
                            paper_bgcolor: 'transparent',
                            autosize: true,
                            hovermode: 'closest'
                          }}
                          style={{ width: '100%', height: '100%' }}
                          config={{ displayModeBar: false, responsive: true }}
                          useResizeHandler
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Comparison shelf — sticky strip at bottom of screen          */}
      {/* ============================================================ */}
      {comparisonShelf.length > 0 && !showComparison && (
        <div className="absolute bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl">
          <div className="px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Layers className="w-4 h-4 text-violet-600" />
              <span className="text-xs uppercase tracking-widest font-bold text-slate-700">
                Comparison · {comparisonShelf.length}/6
              </span>
            </div>
            <div className="flex-1 flex gap-2 overflow-x-auto">
              {comparisonShelf.map((p, i) => (
                <div
                  key={p.id}
                  className="flex-shrink-0 flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-lg border bg-white"
                  style={{ borderColor: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}
                >
                  <span className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }} />
                  <div className="text-xs">
                    <div className="font-bold text-slate-800 leading-tight">{p.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {p.country} · {formatYear(p.startYear)}
                      {p.hgri != null && ` · H-GRI ${p.hgri.toFixed(1)}`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromShelf(p.id)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={clearShelf}
                className="text-xs px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
              <button
                onClick={() => setShowComparison(true)}
                disabled={comparisonShelf.length < 1}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 shadow-md flex items-center gap-1.5 disabled:opacity-40"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Compare
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Comparison modal — full-screen overlay with radars           */}
      {/* ============================================================ */}
      {showComparison && (
        <div className="absolute inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2
                  className="text-2xl text-slate-900"
                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}
                >
                  Comparing {comparisonShelf.length} {comparisonShelf.length === 1 ? 'polity' : 'polities'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each radar shows the polity's profile across 12 government and 3 societal religious-restriction variables (0 = absent, 1 = present).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setCompareMode('grid')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      compareMode === 'grid' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setCompareMode('overlay')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      compareMode === 'overlay' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Overlay
                  </button>
                </div>
                <button
                  onClick={() => setShowComparison(false)}
                  className="p-2 hover:bg-slate-200 rounded-full"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const polityRadarData = comparisonShelf.map((p, i) => ({
                  name: p.name,
                  profile: p.profile,
                  color: COMPARISON_COLORS[i % COMPARISON_COLORS.length],
                }));
                const anyHasProfile = polityRadarData.some(p => p.profile);

                if (!anyHasProfile) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-24">
                      <Sparkles className="w-12 h-12 mb-3 opacity-50" />
                      <p className="font-bold text-slate-600">No religious-tolerance data coded</p>
                      <p className="text-sm mt-1 max-w-md">
                        None of the selected polities have coded religious-tolerance variables in the Seshat dataset.
                      </p>
                    </div>
                  );
                }

                if (compareMode === 'overlay') {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                      <div className="md:col-span-2 flex justify-center">
                        <RadarChart polities={polityRadarData} size={520} />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-xs uppercase tracking-widest font-bold text-slate-700">Legend</h3>
                        {polityRadarData.map((p, i) => {
                          const shelfEntry = comparisonShelf[i];
                          return (
                            <div key={p.name} className="border-l-4 pl-3 py-1" style={{ borderColor: p.color }}>
                              <div className="font-bold text-slate-900 text-sm" style={{ fontFamily: "'Fraunces', serif" }}>
                                {p.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {shelfEntry.country} · {formatYear(shelfEntry.startYear)} → {formatYear(shelfEntry.endYear)}
                              </div>
                              <div className="text-xs text-slate-600 mt-1 flex gap-2">
                                {shelfEntry.hgri != null && (
                                  <span className="font-bold" style={{ color: hgriToColor(shelfEntry.hgri) }}>
                                    H-GRI {shelfEntry.hgri.toFixed(1)}
                                  </span>
                                )}
                                {shelfEntry.mainReligion && <span className="text-amber-700">{shelfEntry.mainReligion}</span>}
                                {!shelfEntry.profile && <span className="text-slate-400 italic">no profile data</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Grid mode
                const cols = comparisonShelf.length <= 2 ? 2 : 3;
                return (
                  <div className={`grid gap-6`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {polityRadarData.map((p, i) => {
                      const shelfEntry = comparisonShelf[i];
                      return (
                        <div key={p.name} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <div className="border-l-4 pl-3 mb-3" style={{ borderColor: p.color }}>
                            <div className="font-bold text-slate-900 leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                              {shelfEntry.country} · {formatYear(shelfEntry.startYear)} → {formatYear(shelfEntry.endYear)}
                            </div>
                          </div>
                          <div className="flex justify-center mb-2">
                            {p.profile ? (
                              <RadarChart polities={[p]} size={300} />
                            ) : (
                              <div className="w-[300px] h-[300px] flex items-center justify-center text-center text-slate-400 text-xs">
                                No religious profile coded
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            {shelfEntry.hgri != null && (
                              <span
                                className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: hgriToColor(shelfEntry.hgri) }}
                              >
                                H-GRI {shelfEntry.hgri.toFixed(1)}
                              </span>
                            )}
                            {shelfEntry.hshi != null && (
                              <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                                H-SHI {shelfEntry.hshi.toFixed(1)}
                              </span>
                            )}
                            {shelfEntry.mainReligion && (
                              <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                {shelfEntry.mainReligion}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer legend */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" /> Government variables
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-700" /> Society variables
                </span>
              </div>
              <span>Larger area on the radar = more restrictive</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  SPREAD-VIEW CLICK POPOVER                                     */}
      {/*  Lightweight inspector: click a polygon on the spread map      */}
      {/*  → see a small card with options to add to shelf or open the   */}
      {/*  full deep-history panel for the country.                       */}
      {/* ============================================================ */}
      {clickedPolity && (
        <div
          className="absolute inset-0 z-[65] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-sm"
          onClick={() => setClickedPolity(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-violet-600 mb-0.5">
                  Polity inspector
                </p>
                <h2 className="text-xl text-slate-900 leading-tight"
                    style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}>
                  {clickedPolity.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {clickedPolity.country} · {formatYear(clickedPolity.startYear)} → {formatYear(clickedPolity.endYear)}
                </p>
              </div>
              <button onClick={() => setClickedPolity(null)} className="p-1.5 hover:bg-slate-200 rounded-full">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {clickedPolity.hgri != null && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: hgriToColor(clickedPolity.hgri) }}>
                    H-GRI {clickedPolity.hgri.toFixed(1)}
                  </span>
                )}
                {clickedPolity.religionFamily && (() => {
                  const fam = RELIGION_FAMILIES.find(f => f.id === clickedPolity.religionFamily);
                  return fam ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: fam.color + '22', color: fam.color }}>
                      {fam.label}
                    </span>
                  ) : null;
                })()}
                {clickedPolity.mainReligion && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    {clickedPolity.mainReligion}
                  </span>
                )}
                {clickedPolity.religiousProfile && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    ◉ profile
                  </span>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button
                onClick={() => {
                  addToShelf(clickedPolity, clickedPolity.country);
                  setClickedPolity(null);
                }}
                disabled={comparisonShelf.length >= 6 ||
                          comparisonShelf.some(p => p.id === (clickedPolity.seshatId || clickedPolity.name))}
                className="flex-1 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Add to shelf
              </button>
              <button
                onClick={() => {
                  setActiveCountry(clickedPolity.country);
                  setGlobeView('modern');
                  setClickedPolity(null);
                }}
                className="flex-1 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1.5"
              >
                Open country
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  SOURCE TRANSPARENCY POPOVER                                  */}
      {/*  Lists every coded indicator that went into this polity's     */}
      {/*  H-GRI score, with raw 0–1 values colored by intensity.       */}
      {/* ============================================================ */}
      {sourceFeature && (
        <div
          className="absolute inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setSourceFeature(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-violet-600 mb-1">
                    H-GRI breakdown
                  </p>
                  <h2
                    className="text-2xl text-slate-900"
                    style={{ fontFamily: "'Fraunces', serif", fontWeight: 900 }}
                  >
                    {sourceFeature.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatYear(sourceFeature.startYear)} → {formatYear(sourceFeature.endYear)}
                    {sourceFeature.mainReligion && ` · ${sourceFeature.mainReligion}`}
                  </p>
                </div>
                <button onClick={() => setSourceFeature(null)} className="p-2 hover:bg-slate-200 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Headline H-GRI */}
              {sourceFeature.hgri != null && (
                <div className="mt-4 flex items-baseline gap-3">
                  <span
                    className="text-4xl font-bold"
                    style={{ fontFamily: "'Fraunces', serif", color: hgriToColor(sourceFeature.hgri) }}
                  >
                    {sourceFeature.hgri.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500">
                    H-GRI / 10 &nbsp;·&nbsp; computed from {sourceFeature.hgriCoverage} of 12 government indicators
                  </span>
                </div>
              )}
            </div>

            {/* Body — variable breakdown */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
                  Government restrictions (12 variables)
                </h3>
                <div className="space-y-1.5">
                  {RADAR_VARS.filter(v => v.type === 'gov').map(v => {
                    const val = sourceFeature.religiousProfile?.[v.key];
                    const coded = typeof val === 'number';
                    return (
                      <div key={v.key} className="flex items-center gap-3 text-xs">
                        <div className="w-44 flex-shrink-0 text-slate-700">{v.label}</div>
                        <div className="flex-1 h-5 rounded bg-slate-100 relative overflow-hidden">
                          {coded ? (
                            <div
                              className="absolute left-0 top-0 bottom-0 transition-all"
                              style={{
                                width: `${val * 100}%`,
                                backgroundColor: hgriToColor(val * 10),
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 italic">
                              not coded
                            </div>
                          )}
                        </div>
                        <div className="w-12 flex-shrink-0 text-right font-mono text-[11px]"
                             style={{ color: coded ? hgriToColor(val * 10) : '#cbd5e1' }}>
                          {coded ? val.toFixed(2) : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-amber-700 mb-2">
                  Societal hostilities (3 variables)
                </h3>
                <div className="space-y-1.5">
                  {RADAR_VARS.filter(v => v.type === 'soc').map(v => {
                    const val = sourceFeature.religiousProfile?.[v.key];
                    const coded = typeof val === 'number';
                    return (
                      <div key={v.key} className="flex items-center gap-3 text-xs">
                        <div className="w-44 flex-shrink-0 text-slate-700">{v.label}</div>
                        <div className="flex-1 h-5 rounded bg-slate-100 relative overflow-hidden">
                          {coded ? (
                            <div
                              className="absolute left-0 top-0 bottom-0"
                              style={{
                                width: `${val * 100}%`,
                                backgroundColor: '#f59e0b',
                                opacity: 0.3 + 0.7 * val,
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 italic">
                              not coded
                            </div>
                          )}
                        </div>
                        <div className="w-12 flex-shrink-0 text-right font-mono text-[11px] text-amber-700">
                          {coded ? val.toFixed(2) : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 leading-relaxed">
              Values are derived from Seshat's coding: <strong>1.0</strong> = restriction definitely present,
              <strong> 0.0</strong> = definitely absent, <strong>0.5</strong> = transitional or partial.
              The H-GRI is the unweighted mean across coded variables, scaled to 0–10.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

/* Helper: format Seshat Time (years CE; negative = BCE) into a label */
function formatYear(t) {
  if (t == null) return '—';
  if (t < 0) return `${Math.abs(t)} BCE`;
  return `${t} CE`;
}

export default WorldMap;