// scorer.js
// University Guidebook - school-level weighted scorer
// 仅负责学校级打分算法，不处理持久化、不处理 DOM、不处理筛选逻辑。

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstFiniteNumber(values) {
  if (!Array.isArray(values)) return null;
  for (const value of values) {
    const n = toFiniteNumber(value);
    if (n != null) return n;
  }
  return null;
}

function uniqueNumbers(values) {
  return [...new Set((values || []).filter((v) => Number.isFinite(v)))];
}

function sumNumbers(values) {
  return (values || []).reduce((sum, value) => sum + value, 0);
}

function parseDurationToYears(durationRaw) {
  const raw = String(durationRaw || '').trim();
  if (!raw) return null;

  // 纯数字：3 / 4 / 5
  const direct = raw.match(/^\d+(\.\d+)?$/);
  if (direct) {
    return Number(raw);
  }

  // 合办 / 公式型：2+2 / 2+3 / 1.5+1.5
  if (raw.includes('+')) {
    const parts = raw
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(part));

    if (parts.length > 0 && parts.every((n) => Number.isFinite(n))) {
      return sumNumbers(parts);
    }
  }

  // 兜底：提取所有数字
  // 例如极端脏数据里出现 "2 years + 2 years"
  const matches = raw.match(/\d+(\.\d+)?/g);
  if (matches && raw.includes('+')) {
    const parts = matches.map(Number).filter((n) => Number.isFinite(n));
    if (parts.length > 0) return sumNumbers(parts);
  }

  return null;
}

function mapDurationToScore(durationYears) {
  const n = toFiniteNumber(durationYears);
  if (n == null) return null;

  if (n <= 3) return 100;
  if (n === 4) return 70;
  if (n === 5) return 35;
  return 10;
}

function getProgramsFromSchool(school) {
  if (Array.isArray(school?.programs)) return school.programs;
  if (Array.isArray(school?.items)) return school.items;
  return [];
}

function getRepresentativeProgram(school) {
  return (
    school?.representativeProgram ||
    school?.representative_program ||
    getProgramsFromSchool(school)[0] ||
    null
  );
}

function getProgramLocationItems(program) {
  return Array.isArray(program?.location_items) ? program.location_items : [];
}

function getProgramLanguageScore(program) {
  const fromList =
    firstFiniteNumber(program?.language_score_list) ??
    firstFiniteNumber(program?.sort_language_score_list);

  if (fromList != null) return fromList;

  const fromLocationItems = firstFiniteNumber(
    getProgramLocationItems(program).map((item) => item?.language_score)
  );
  if (fromLocationItems != null) return fromLocationItems;

  return null;
}

function getProgramLanguageOrder(program) {
  const direct =
    toFiniteNumber(program?.language_order) ??
    toFiniteNumber(program?.sort_language_order);

  if (direct != null) return direct;

  const listValue = firstFiniteNumber(program?.language_order_list);
  if (listValue != null) return listValue;

  const fromLocationItems = firstFiniteNumber(
    getProgramLocationItems(program).map((item) => item?.language_order)
  );
  if (fromLocationItems != null) return fromLocationItems;

  return null;
}

function getProgramResidencyOrder(program) {
  return (
    toFiniteNumber(program?.residency_order) ??
    toFiniteNumber(program?.sort_residency_order) ??
    firstFiniteNumber(program?.residency_order_list) ??
    firstFiniteNumber(
      getProgramLocationItems(program).map((item) => item?.residency_order)
    ) ??
    null
  );
}

function getProgramClimateOrder(program) {
  return (
    toFiniteNumber(program?.climate_order) ??
    toFiniteNumber(program?.sort_climate_order) ??
    firstFiniteNumber(program?.climate_order_list) ??
    firstFiniteNumber(
      getProgramLocationItems(program).map((item) => item?.climate_order)
    ) ??
    null
  );
}

function getProgramCityScaleOrder(program) {
  return (
    toFiniteNumber(program?.city_scale_order) ??
    toFiniteNumber(program?.sort_city_scale_order) ??
    firstFiniteNumber(program?.city_scale_order_list) ??
    firstFiniteNumber(
      getProgramLocationItems(program).map((item) => item?.city_scale_order)
    ) ??
    null
  );
}

function getSchoolLanguageScore(school, representativeProgram) {
  const direct =
    toFiniteNumber(school?.language_score) ??
    toFiniteNumber(school?.sort_language_score);

  if (direct != null) return direct;
  return getProgramLanguageScore(representativeProgram);
}

function getSchoolResidencyOrder(school, representativeProgram) {
  const direct =
    toFiniteNumber(school?.residency_order) ??
    toFiniteNumber(school?.sort_residency_order);

  if (direct != null) return direct;
  return getProgramResidencyOrder(representativeProgram);
}

function getSchoolClimateOrder(school, representativeProgram) {
  const direct =
    toFiniteNumber(school?.climate_order) ??
    toFiniteNumber(school?.sort_climate_order);

  if (direct != null) return direct;
  return getProgramClimateOrder(representativeProgram);
}

function getSchoolCityScaleOrder(school, representativeProgram) {
  const direct =
    toFiniteNumber(school?.city_scale_order) ??
    toFiniteNumber(school?.sort_city_scale_order);

  if (direct != null) return direct;
  return getProgramCityScaleOrder(representativeProgram);
}

function computeDominantDuration(programs, representativeProgram = null) {
  const counts = new Map();

  for (const program of programs || []) {
    const durationYears =
      toFiniteNumber(program?.duration_value) ??
      parseDurationToYears(program?.duration);

    if (durationYears == null) continue;
    counts.set(durationYears, (counts.get(durationYears) || 0) + 1);
  }

  if (counts.size === 0) {
    return (
      toFiniteNumber(representativeProgram?.duration_value) ??
      parseDurationToYears(representativeProgram?.duration)
    );
  }

  const ranked = [...counts.entries()].sort((a, b) => {
    const [durationA, countA] = a;
    const [durationB, countB] = b;

    // 先按频次降序
    if (countA !== countB) return countB - countA;
    // 并列时取更短
    return durationA - durationB;
  });

  return ranked[0][0];
}

export function getDefaultScoreWeights() {
  return {
    qs: 0,
    the: 0,
    usnews: 0,
    language_score: 0,
    residency_order: 0,
    climate_order: 0,
    city_scale_order: 0,
    duration_score: 0
  };
}

export function sanitizeScoreWeights(input) {
  const defaults = getDefaultScoreWeights();
  const cleaned = { ...defaults };

  if (!input || typeof input !== 'object') {
    return cleaned;
  }

  Object.keys(defaults).forEach((key) => {
    const n = Number(input[key]);
    cleaned[key] = Number.isFinite(n) && n >= 0 ? n : 0;
  });

  return cleaned;
}

export function getScoreFactorDefs() {
  return [
    {
      key: 'qs',
      label: 'QS',
      direction: 'lowerBetter',
      getValue: (school) => school?.score_inputs?.qs ?? null
    },
    {
      key: 'the',
      label: 'THE',
      direction: 'lowerBetter',
      getValue: (school) => school?.score_inputs?.the ?? null
    },
    {
      key: 'usnews',
      label: 'US News',
      direction: 'lowerBetter',
      getValue: (school) => school?.score_inputs?.usnews ?? null
    },
    {
      key: 'language_score',
      label: '语言环境',
      direction: 'higherBetter',
      getValue: (school) => school?.score_inputs?.language_score ?? null
    },
    {
      key: 'residency_order',
      label: '居留',
      direction: 'lowerBetter',
      getValue: (school) => school?.score_inputs?.residency_order ?? null
    },
    {
      key: 'climate_order',
      label: '气候',
      direction: 'lowerBetter',
      getValue: (school) => school?.score_inputs?.climate_order ?? null
    },
    {
      key: 'city_scale_order',
      label: '城市规模',
      direction: 'lowerBetter',
      getValue: (school) => school?.score_inputs?.city_scale_order ?? null
    },
    {
      key: 'duration_score',
      label: '学制',
      direction: 'higherBetter',
      getValue: (school) => school?.score_inputs?.duration_score ?? null
    }
  ];
}

export function buildSchoolScoreInputs(school) {
  const representativeProgram = getRepresentativeProgram(school);
  const programs = getProgramsFromSchool(school);

  const dominantDuration = computeDominantDuration(programs, representativeProgram);
  const durationScore = mapDurationToScore(dominantDuration);

  return {
    qs: toFiniteNumber(school?.qs),
    the: toFiniteNumber(school?.the),
    usnews: toFiniteNumber(school?.usnews),

    language_score: getSchoolLanguageScore(school, representativeProgram),
    residency_order: getSchoolResidencyOrder(school, representativeProgram),
    climate_order: getSchoolClimateOrder(school, representativeProgram),
    city_scale_order: getSchoolCityScaleOrder(school, representativeProgram),

    dominant_duration: dominantDuration,
    duration_score: durationScore
  };
}

export function normalizeValues(values, direction = 'higherBetter') {
  const valid = uniqueNumbers(values);
  if (valid.length === 0) {
    return values.map(() => null);
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);

  if (max === min) {
    return values.map((value) => (Number.isFinite(value) ? 1 : null));
  }

  return values.map((value) => {
    if (!Number.isFinite(value)) return null;

    if (direction === 'lowerBetter') {
      return (max - value) / (max - min);
    }

    return (value - min) / (max - min);
  });
}

export function hasActiveScoreWeights(weights) {
  const cleaned = sanitizeScoreWeights(weights);
  return Object.values(cleaned).some((value) => value > 0);
}

export function computeWeightedScoresForSchools(schools, weights) {
  const safeWeights = sanitizeScoreWeights(weights);
  const factorDefs = getScoreFactorDefs();

  const schoolsWithInputs = (schools || []).map((school) => {
    const scoreInputs = buildSchoolScoreInputs(school);
    return {
      ...school,
      score_inputs: scoreInputs
    };
  });

  if (schoolsWithInputs.length === 0) {
    return [];
  }

  const normalizedByFactor = {};

  factorDefs.forEach((factor) => {
    const rawValues = schoolsWithInputs.map((school) => {
      const value = factor.getValue(school);
      return toFiniteNumber(value);
    });

    normalizedByFactor[factor.key] = normalizeValues(rawValues, factor.direction);
  });

  return schoolsWithInputs.map((school, index) => {
    let weightedSum = 0;
    let effectiveWeightSum = 0;

    const scoreBreakdown = {};

    factorDefs.forEach((factor) => {
      const weight = toFiniteNumber(safeWeights[factor.key]) ?? 0;
      const rawValue = toFiniteNumber(factor.getValue(school));
      const normalizedValue = normalizedByFactor[factor.key][index];

      const isActive = weight > 0;
      const isUsable = isActive && rawValue != null && normalizedValue != null;

      if (isUsable) {
        weightedSum += weight * normalizedValue;
        effectiveWeightSum += weight;
      }

      scoreBreakdown[factor.key] = {
        label: factor.label,
        direction: factor.direction,
        raw_value: rawValue,
        normalized_value: normalizedValue,
        weight,
        contribution: isUsable ? weight * normalizedValue : 0,
        is_active: isActive,
        is_usable: isUsable
      };
    });

    const totalScore =
      effectiveWeightSum > 0 ? (weightedSum / effectiveWeightSum) * 100 : null;

    return {
      ...school,
      total_score: totalScore,
      score_breakdown: scoreBreakdown,
      score_meta: {
        weighted_sum: weightedSum,
        effective_weight_sum: effectiveWeightSum,
        has_active_weights: hasActiveScoreWeights(safeWeights)
      }
    };
  });
}

export function computeSchoolScores(schools, weights) {
  return computeWeightedScoresForSchools(schools, weights);
}