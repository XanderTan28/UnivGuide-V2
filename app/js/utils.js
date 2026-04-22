export const languageLabelMap = {
  1: '能说中文',
  2: '英文主导',
  3: '都会英文',
  4: '一半会英文',
  5: '英文不方便'
};

export function joinDisplayValues(values, options = {}) {
  const { unique = false, separator = ', ' } = options;

  let result = (values || [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  if (unique) {
    result = [...new Set(result)];
  }

  return result.join(separator);
}

export function parseCSV(text) {
  const cleaned = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];

  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const next = cleaned[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => String(h || '').trim());

  return rows
    .slice(1)
    .filter((r) => r.some((v) => String(v || '').trim() !== ''))
    .map((r) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = String(r[idx] ?? '').trim();
      });
      return obj;
    });
}

export function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

export function splitPlusValues(value) {
  return String(value || '')
    .split('+')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function unique(values) {
  return [...new Set((values || []).filter((v) => v !== '' && v != null))];
}

export function uniqueStrings(values) {
  return unique(
    (values || []).map((v) => String(v || '').trim()).filter(Boolean)
  );
}

export function indexBy(rows, keyField, valueField) {
  const map = {};
  (rows || []).forEach((row) => {
    const key = String(row?.[keyField] || '').trim();
    const value = String(row?.[valueField] || '').trim();
    if (key) map[key] = value;
  });
  return map;
}

export function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function toNumberOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'zh-CN');
}

export function compareNullableNumber(a, b, direction = 'asc') {
  const av = a == null ? null : Number(a);
  const bv = b == null ? null : Number(b);

  const aMissing = av == null || !Number.isFinite(av);
  const bMissing = bv == null || !Number.isFinite(bv);

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  return direction === 'desc' ? bv - av : av - bv;
}

export function compareNullableText(a, b, direction = 'asc') {
  const aa = String(a || '').trim();
  const bb = String(b || '').trim();

  const aMissing = !aa;
  const bMissing = !bb;

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  return direction === 'desc'
    ? bb.localeCompare(aa, 'zh-CN')
    : aa.localeCompare(bb, 'zh-CN');
}

export function includesText(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

export function matchesSearch(program, keyword) {
  const q = String(keyword || '').trim().toLowerCase();
  if (!q) return true;

  const fields = [
    program.program_id,
    program.university_slug,
    program.display_name,
    program.program,

    program.faculty_raw,
    ...(program.faculty_list || []),
    ...(program.faculty_group_list || []),

    program.campus_raw,
    ...(program.campus_list || []),

    ...(program.city_list || []),
    ...(program.country_list || []),
    ...(program.region_list || []),
    ...(program.city_scale_list || []),
    ...(program.climate_list || []),
    ...(program.language_list || []),
    ...(program.residency_list || []),

    program.duration,
    program.eng_taught,
    program.type
  ];

  return fields.some((field) => includesText(field, q));
}

export function hasIntersection(itemValues, selectedValues) {
  if (!Array.isArray(selectedValues) || selectedValues.length === 0) return true;
  if (!Array.isArray(itemValues) || itemValues.length === 0) return false;

  const set = new Set(selectedValues.map((v) => String(v)));
  return itemValues.some((v) => set.has(String(v)));
}

export function textYesNo(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1') {
    return '是';
  }
  if (normalized === 'false' || normalized === 'no' || normalized === 'n' || normalized === '0') {
    return '否';
  }
  return value || '';
}