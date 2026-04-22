import { loadAllData } from './data_loader.js';
import { normalizePrograms } from './data_normalizer.js';
import { applyFilters, buildFilterOptions } from './filters.js';
import { getDefaultScoreWeights } from './scorer.js';
import {
  renderFilterOptions,
  renderSummary,
  renderTable,
  bindStaticEvents,
  bindDynamicFilterEvents
} from './render.js';

const state = {
  rawLoaded: null,
  normalized: [],
  filtered: [],
  ui: {
    search: '',
    schools: [],
    regions: [],
    countries: [],
    cities: [],
    campuses: [],
    facultyGroups: [],
    durations: [],
    types: [],
    engTaught: [],
    cityScales: [],
    climates: [],
    languages: [],
    residencies: [],
    sortMetric: 'manifest_order',
    sortDirection: 'asc',
    scoreWeights: getDefaultScoreWeights()
  }
};

let sideRailRaf = 0;
let sideRailResizeObserver = null;

function syncContentSideRail() {
  const shell = document.querySelector('.content-shell');
  const main = document.querySelector('.content-main-bottom');
  const side = document.querySelector('.content-side');
  const sideInner = document.getElementById('contentSideInner');
  const header = document.querySelector('.app-header');

  if (!shell || !main || !side || !sideInner || !header) return;

  const desktop = window.innerWidth > 1400;

  sideInner.classList.remove('is-rail-fixed', 'is-rail-bottom');
  side.style.minHeight = '';

  if (!desktop) {
    side.style.removeProperty('--content-side-left');
    side.style.removeProperty('--content-side-width');
    return;
  }

  const headerHeight = Math.ceil(header.getBoundingClientRect().height);
  const topOffset = headerHeight + 20;

  side.style.setProperty('--content-side-top', `${topOffset}px`);

  const sideRect = side.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();

  const scrollY = window.scrollY;
  const sideTop = sideRect.top + scrollY;
  const mainBottom = mainRect.bottom + scrollY;

  const railHeight = sideInner.offsetHeight;
  const bottomGap = 24;
  const startStickY = sideTop - topOffset;
  const endStickY = mainBottom - railHeight - topOffset - bottomGap;

  side.style.setProperty('--content-side-left', `${Math.round(sideRect.left)}px`);
  side.style.setProperty('--content-side-width', `${Math.round(sideRect.width)}px`);
  side.style.minHeight = `${railHeight}px`;

  if (scrollY <= startStickY) {
    return;
  }

  if (endStickY <= startStickY) {
    sideInner.classList.add('is-rail-fixed');
    return;
  }

  if (scrollY < endStickY) {
    sideInner.classList.add('is-rail-fixed');
    return;
  }

  sideInner.classList.add('is-rail-bottom');
}

function requestSyncContentSideRail() {
  if (sideRailRaf) cancelAnimationFrame(sideRailRaf);
  sideRailRaf = requestAnimationFrame(() => {
    sideRailRaf = 0;
    syncContentSideRail();
  });
}

function initContentSideRail() {
  requestSyncContentSideRail();

  window.addEventListener('scroll', requestSyncContentSideRail, { passive: true });
  window.addEventListener('resize', requestSyncContentSideRail);

  if (typeof ResizeObserver === 'function') {
    const shell = document.querySelector('.content-shell');
    const sideInner = document.getElementById('contentSideInner');

    sideRailResizeObserver = new ResizeObserver(() => {
      requestSyncContentSideRail();
    });

    if (shell) sideRailResizeObserver.observe(shell);
    if (sideInner) sideRailResizeObserver.observe(sideInner);
  }
}

function applyCurrentState() {
  const filtered = applyFilters(state.normalized, state.ui);

  state.filtered = filtered;

  renderFilterOptions(state.normalized, state.ui, state.rawLoaded?.mappings);
  bindDynamicFilterEvents(state, refresh);
  renderSummary(state.filtered, state.normalized);
  renderTable(
    state.filtered,
    state.ui.sortMetric,
    state.ui.sortDirection,
    state.ui.scoreWeights
  );
}

function refresh() {
  applyCurrentState();
  requestSyncContentSideRail();
}

async function bootstrap() {
  try {
    const loaded = await loadAllData();
    state.rawLoaded = loaded;
    state.normalized = normalizePrograms(loaded);

    const options = buildFilterOptions(state.normalized, loaded.mappings);

    state.ui.schools = [...options.schools];
    state.ui.regions = [...options.regions];
    state.ui.countries = [...options.countries];
    state.ui.cities = [...options.cities];
    state.ui.campuses = [...options.campuses];
    state.ui.facultyGroups = [...options.facultyGroups];
    state.ui.durations = [...options.durations];
    state.ui.types = [...options.types];
    state.ui.cityScales = [...options.cityScales];
    state.ui.climates = [...options.climates];
    state.ui.languages = [...options.languages];
    state.ui.residencies = [...options.residencies];
    state.ui.engTaught = ['true'];

    applyCurrentState();
    bindStaticEvents(state, refresh);
    initContentSideRail();
  } catch (error) {
    console.error(error);
  }
}

bootstrap();
