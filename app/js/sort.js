import {
  compareNullableNumber,
  compareNullableText
} from './utils.js';

function firstValue(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list[0];
}

function comparePrograms(a, b, metric, direction) {
  switch (metric) {
    case 'manifest_order':
      return compareNullableNumber(a.manifest_order, b.manifest_order, direction);

    case 'qs':
      return compareNullableNumber(a.qs, b.qs, direction);

    case 'the':
      return compareNullableNumber(a.the, b.the, direction);

    case 'usnews':
      return compareNullableNumber(a.usnews, b.usnews, direction);

    case 'program':
      return compareNullableText(a.program, b.program, direction);

    case 'faculty_group':
      return compareNullableText(
        firstValue(a.faculty_group_list),
        firstValue(b.faculty_group_list),
        direction
      );

    case 'duration':
      return compareNullableText(a.duration, b.duration, direction);

    case 'city':
      return compareNullableText(firstValue(a.city_list), firstValue(b.city_list), direction);

    case 'country':
      return compareNullableText(firstValue(a.country_list), firstValue(b.country_list), direction);

    case 'region':
      return compareNullableText(firstValue(a.region_list), firstValue(b.region_list), direction);

    case 'language': {
      const byOrder = compareNullableNumber(a.language_order, b.language_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(firstValue(a.language_list), firstValue(b.language_list), direction);
    }

    case 'city_scale': {
      const byOrder = compareNullableNumber(a.city_scale_order, b.city_scale_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(firstValue(a.city_scale_list), firstValue(b.city_scale_list), direction);
    }

    case 'climate': {
      const byOrder = compareNullableNumber(a.climate_order, b.climate_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(firstValue(a.climate_list), firstValue(b.climate_list), direction);
    }

    case 'residency': {
      const byOrder = compareNullableNumber(a.residency_order, b.residency_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(firstValue(a.residency_list), firstValue(b.residency_list), direction);
    }

    default:
      return compareNullableNumber(a.manifest_order, b.manifest_order, direction);
  }
}

export function sortPrograms(programs, metric = 'manifest_order', direction = 'asc') {
  return [...(programs || [])].sort((a, b) => {
    const primary = comparePrograms(a, b, metric, direction);
    if (primary !== 0) return primary;

    const tie1 = compareNullableNumber(a.manifest_order, b.manifest_order, 'asc');
    if (tie1 !== 0) return tie1;

    const tie2 = compareNullableText(
      a.display_name || a.university_slug,
      b.display_name || b.university_slug,
      'asc'
    );
    if (tie2 !== 0) return tie2;

    const tie3 = compareNullableText(a.program, b.program, 'asc');
    if (tie3 !== 0) return tie3;

    return compareNullableText(a.program_id, b.program_id, 'asc');
  });
}