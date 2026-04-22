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
  } catch (error) {
    console.error(error);
  }
}

bootstrap();