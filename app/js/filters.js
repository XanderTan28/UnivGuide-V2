import {
  matchesSearch,
  hasIntersection,
  languageLabelMap
} from './utils.js';

function sortValuesByOrderThenLabel(values, orderMap = null) {
  return [...(values || [])].sort((a, b) => {
    const ao = orderMap?.[a];
    const bo = orderMap?.[b];

    const aHasOrder = Number.isFinite(ao);
    const bHasOrder = Number.isFinite(bo);

    if (aHasOrder && bHasOrder && ao !== bo) {
      return ao - bo;
    }

    if (aHasOrder && !bHasOrder) return -1;
    if (!aHasOrder && bHasOrder) return 1;

    return String(a).localeCompare(String(b), 'zh-CN');
  });
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildDisplayOrderMapFromRows(rows, valueField) {
  const map = {};

  (rows || []).forEach((row) => {
    const value = String(row?.[valueField] || '').trim();
    const order = Number(row?.sort_order);

    if (!value || !Number.isFinite(order)) return;
    if (map[value] == null) {
      map[value] = order;
    }
  });

  return map;
}

function buildLanguageDisplayOrderMap(rows) {

  const map = {};

  (rows || []).forEach((row) => {
    const order = Number(row?.sort_order);
    const label = languageLabelMap[order];

    if (!label || !Number.isFinite(order)) return;
    if (map[label] == null) {
      map[label] = order;
    }
  });

  return map;
}

function matchArray(selectedValues, itemValues) {
  if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
    return true;
  }

  const normalizedItems = Array.isArray(itemValues)
    ? itemValues.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (normalizedItems.length === 0) {
    return true;
  }

  return hasIntersection(normalizedItems, selectedValues);
}

export function applyFilters(programs, ui) {
  return (programs || []).filter((program) => {
    if (!matchesSearch(program, ui.search)) return false;

    if (!matchArray(ui.schools, [program.university_slug, program.display_name])) {
      return false;
    }

    if (!matchArray(ui.regions, program.region_list)) return false;
    if (!matchArray(ui.countries, program.country_list)) return false;
    if (!matchArray(ui.cities, program.city_list)) return false;
    if (!matchArray(ui.campuses, program.campus_list)) return false;
    if (!matchArray(ui.durations, [program.duration])) return false;
    if (!matchArray(ui.types, [program.type])) return false;
    if (!matchArray(ui.cityScales, program.city_scale_list)) return false;
    if (!matchArray(ui.climates, program.climate_list)) return false;
    if (!matchArray(ui.languages, program.language_list)) return false;
    if (!matchArray(ui.residencies, program.residency_list)) return false;

    if (
      ui.facultyGroups.length > 0 &&
      program.faculty_group_list.length > 0 &&
      !matchArray(ui.facultyGroups, program.faculty_group_list)
    ) {
      return false;
    }

    const normalizedEngTaught = normalizeEngTaught(program.eng_taught);
    if (!matchArray(ui.engTaught, normalizedEngTaught ? [normalizedEngTaught] : [])) {
      return false;
    }

    return true;
  });
}

export function normalizeEngTaught(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1') {
    return 'true';
  }

  if (normalized === 'false' || normalized === 'no' || normalized === 'n' || normalized === '0') {
    return 'false';
  }

  return '';
}

export function buildFilterOptions(programs, mappings) {
  const options = {
    schools: new Set(),
    regions: new Set(),
    countries: new Set(),
    cities: new Set(),
    campuses: new Set(),
    facultyGroups: new Set(),
    durations: new Set(),
    types: new Set()
  };

  (programs || []).forEach((program) => {
    options.schools.add(program.university_slug);

    (program.region_list || []).forEach((v) => options.regions.add(v));
    (program.country_list || []).forEach((v) => options.countries.add(v));
    (program.city_list || []).forEach((v) => options.cities.add(v));
    (program.campus_list || []).forEach((v) => options.campuses.add(v));
    (program.faculty_group_list || []).forEach((v) => options.facultyGroups.add(v));

    if (program.duration) {
      options.durations.add(program.duration);
    }

    if (program.type) {
      options.types.add(program.type);
    }
  });

  const cityScaleValues = unique((programs || []).flatMap((p) => p.city_scale_list || []));
  const climateValues = unique((programs || []).flatMap((p) => p.climate_list || []));
  const languageValues = unique((programs || []).flatMap((p) => p.language_list || []));
  const residencyValues = unique((programs || []).flatMap((p) => p.residency_list || []));

  const cityScaleOrderMap = buildDisplayOrderMapFromRows(mappings?.cityScaleRows, 'city_scale');
  const climateOrderMap = buildDisplayOrderMapFromRows(mappings?.climateRows, 'climate');
  const residencyOrderMap = buildDisplayOrderMapFromRows(mappings?.residencyRows, 'residency');
  const languageOrderMap = buildLanguageDisplayOrderMap(mappings?.languageRows);

  return {
    schools: [...options.schools].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    regions: [...options.regions].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    countries: [...options.countries].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    cities: [...options.cities].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    campuses: [...options.campuses].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    facultyGroups: [...options.facultyGroups].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    durations: [...options.durations].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    types: [...options.types].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')),
    cityScales: sortValuesByOrderThenLabel(cityScaleValues, cityScaleOrderMap),
    climates: sortValuesByOrderThenLabel(climateValues, climateOrderMap),
    languages: sortValuesByOrderThenLabel(languageValues, languageOrderMap),
    residencies: sortValuesByOrderThenLabel(residencyValues, residencyOrderMap)
  };
}
