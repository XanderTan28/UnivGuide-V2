import {
  slugify,
  splitPlusValues,
  unique,
  indexBy,
  toNumberOrNull,
  languageLabelMap
} from './utils.js';

function buildValueOrderMaps(rows, keyField, valueField) {
  const valueMap = {};
  const orderMap = {};

  (rows || []).forEach((row) => {
    const key = String(row?.[keyField] || '').trim();
    const value = String(row?.[valueField] || '').trim();

    const orderRaw =
      row?.sort_order ??
      row?.sortOrder ??
      row?.order ??
      row?.rank_order ??
      '';

    const order = toNumberOrNull(orderRaw);

    if (key) valueMap[key] = value;

    if (value && order != null && orderMap[value] == null) {
      orderMap[value] = order;
    }
  });

  return { valueMap, orderMap };
}

function buildCountryRegionMap(regionRows) {
  return indexBy(regionRows, 'country', 'region');
}

function buildRankingMap(rows) {
  const map = {};

  (rows || []).forEach((row) => {
    const slug = String(row?.slug || '').trim();
    if (!slug) return;

    map[slug] = {
      qs: toNumberOrNull(row.qs),
      the: toNumberOrNull(row.the),
      usnews: toNumberOrNull(row.usnews)
    };
  });

  return map;
}

function buildDisplayNameMap(rows) {
  return indexBy(rows, 'slug', 'display_name');
}

function buildCampusCityMap(rows) {
  return indexBy(rows, 'campus', 'city');
}

function buildFacultyGroupMap(rows) {
  return indexBy(rows, 'faculty', 'faculty_group');
}

function buildProgramId(program) {
  return slugify(
    [
      program.university_slug,
      program.program,
      program.faculty_raw,
      program.campus_raw,
      program.duration
    ].join('_')
  );
}

function getOrderForList(values, orderMap) {
  if (!Array.isArray(values) || values.length === 0) return null;

  const numericOrders = values
    .map((value) => orderMap[value])
    .filter((order) => Number.isFinite(order));

  if (numericOrders.length === 0) return null;
  return Math.min(...numericOrders);
}

function buildLanguageMaps(rows) {
  const difficultyMap = {};
  const scoreMap = {};
  const orderMap = {};

  (rows || []).forEach((row) => {
    const city = String(row?.city || '').trim();
    if (!city) return;

    const score = toNumberOrNull(row?.language_score);
    const order = toNumberOrNull(
      row?.sort_order ??
      row?.sortOrder ??
      row?.order ??
      ''
    );

    if (score != null) {
      scoreMap[city] = score;
    }

    if (order != null) {
      difficultyMap[city] = languageLabelMap[order] || `未定义${order}`;
      orderMap[city] = order;
    }
  });

  return {
    difficultyMap,
    scoreMap,
    orderMap
  };
}

function buildLocationItems({
  campusList,
  campusCityMap,
  countryMap,
  regionMap,
  cityScaleMap,
  climateMap,
  languageDifficultyMap,
  languageScoreMap,
  languageOrderMap,
  residencyMap
}) {
  const items = [];
  const seenCities = new Set();

  (campusList || []).forEach((campus) => {
    const city = campusCityMap[campus];
    if (!city) return;
    if (seenCities.has(city)) return;

    seenCities.add(city);

    const country = countryMap[city] || '';
    const region = country ? (regionMap[country] || '') : '';
    const cityScale = cityScaleMap[city] || '';
    const climate = climateMap[city] || '';
    const language = languageDifficultyMap[city] || '';
    const languageScore = languageScoreMap[city] ?? null;
    const languageOrder = languageOrderMap[city] ?? null;
    const residency = country ? (residencyMap[country] || '') : '';

    items.push({
      campus,
      city,
      country,
      region,
      city_scale: cityScale,
      climate,
      language,
      language_score: languageScore,
      language_order: languageOrder,
      residency
    });
  });

  return items;
}

function parseDurationToYears(durationRaw) {
  const raw = String(durationRaw || '').trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  if (raw.includes('+')) {
    const parts = raw
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(part));

    if (parts.length > 0 && parts.every((n) => Number.isFinite(n))) {
      return parts.reduce((sum, n) => sum + n, 0);
    }
  }

  return null;
}

export function normalizePrograms(loaded) {
  const { mappings, schoolBundles } = loaded;

  const { valueMap: cityScaleMap, orderMap: cityScaleOrderMap } =
    buildValueOrderMaps(mappings.cityScaleRows, 'city', 'city_scale');

  const { valueMap: climateMap, orderMap: climateOrderMap } =
    buildValueOrderMaps(mappings.climateRows, 'city', 'climate');

  const countryMap = indexBy(mappings.countryRows, 'city', 'country');
  const regionMap = buildCountryRegionMap(mappings.regionRows);

  const { valueMap: residencyMap, orderMap: residencyOrderMap } =
    buildValueOrderMaps(mappings.residencyRows, 'country', 'residency');

  const {
    difficultyMap: languageDifficultyMap,
    scoreMap: languageScoreMap,
    orderMap: languageOrderMap
  } = buildLanguageMaps(mappings.languageRows);

  const rankingMap = buildRankingMap(mappings.rankingRows);
  const displayNameMap = buildDisplayNameMap(mappings.displayNameRows);
  const facultyGroupMap = buildFacultyGroupMap(mappings.facultyGroupRows);

  const results = [];

  (schoolBundles || []).forEach((bundle) => {
    const school = bundle.school;
    const campusCityMap = buildCampusCityMap(bundle.campusCityRows);

    const universitySlug = school.slug;
    const displayName = displayNameMap[universitySlug] || universitySlug;
    const ranking = rankingMap[universitySlug] || { qs: null, the: null, usnews: null };

    (bundle.programRows || []).forEach((row) => {
      const facultyRaw = String(row.faculty || '').trim();
      const facultyList = splitPlusValues(facultyRaw);
      const facultyGroupList = unique(
        facultyList.map((faculty) => facultyGroupMap[faculty]).filter(Boolean)
      );

      const campusRaw = String(row.campus || '').trim();
      const campusList = splitPlusValues(campusRaw);

      const locationItems = buildLocationItems({
        campusList,
        campusCityMap,
        countryMap,
        regionMap,
        cityScaleMap,
        climateMap,
        languageDifficultyMap,
        languageScoreMap,
        languageOrderMap,
        residencyMap
      });

      const cityList = unique(
        locationItems.map((item) => item.city).filter(Boolean)
      );

      const countryList = unique(
        locationItems.map((item) => item.country).filter(Boolean)
      );

      const regionList = unique(
        locationItems.map((item) => item.region).filter(Boolean)
      );

      const cityScaleList = unique(
        locationItems.map((item) => item.city_scale).filter(Boolean)
      );

      const climateList = unique(
        locationItems.map((item) => item.climate).filter(Boolean)
      );

      const languageList = unique(
        locationItems.map((item) => item.language).filter(Boolean)
      );

      const languageScoreList = unique(
        locationItems
          .map((item) => item.language_score)
          .filter((v) => v != null)
      );

      const languageOrderList = unique(
        locationItems
          .map((item) => item.language_order)
          .filter((v) => v != null)
      );

      const residencyList = unique(
        locationItems.map((item) => item.residency).filter(Boolean)
      );

      const durationRaw = String(row.duration || '').trim();

      const normalized = {
        university_slug: universitySlug,
        display_name: displayName,
        manifest_order: bundle.manifest_order,
        uni_color: String(school.uniColor || '').trim().toLowerCase(),

        program: String(row.program || '').trim(),

        faculty_raw: facultyRaw,
        faculty_list: facultyList,
        faculty_group_list: facultyGroupList,
        faculty_group: facultyGroupList.join('+'),

        campus_raw: campusRaw,
        campus_list: campusList,

        location_items: locationItems,

        city_list: cityList,
        country_list: countryList,
        region_list: regionList,

        city_scale_list: cityScaleList,
        climate_list: climateList,

        language_list: languageList,
        language_score_list: languageScoreList,
        language_order: languageOrderList.length ? Math.min(...languageOrderList) : null,

        residency_list: residencyList,

        city_scale_order: getOrderForList(cityScaleList, cityScaleOrderMap),
        climate_order: getOrderForList(climateList, climateOrderMap),
        residency_order: getOrderForList(residencyList, residencyOrderMap),

        duration: durationRaw,
        duration_value: parseDurationToYears(durationRaw),

        eng_taught: String(row.eng_taught || '').trim(),
        type: String(row.type || '').trim(),
        url: String(row.url || '').trim(),

        qs: ranking.qs,
        the: ranking.the,
        usnews: ranking.usnews
      };

      normalized.program_id = buildProgramId(normalized);

      results.push(normalized);
    });
  });

  return results;
}