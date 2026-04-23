import { buildFilterOptions } from './filters.js';
import {
  computeSchoolScores,
  getDefaultScoreWeights,
  getScoreFactorDefs,
  sanitizeScoreWeights,
  hasActiveScoreWeights
} from './scorer.js';
import {
  escapeHtml,
  textYesNo,
  compareNullableNumber,
  compareNullableText
} from './utils.js';
import { renderLocationScene } from './render_location_scene.js';

const expandedUniversitySet = new Set();
let currentOpenDropdownHostId = null;
const dropdownScrollTopMap = {};
const recommendedScoreWeights = {
  qs: 1,
  the: 1,
  usnews: 1,
  language_score: 1,
  residency_order: 1,
  climate_order: 0.8,
  city_scale_order: 0.8,
  duration_score: 0.6
};

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

function joinDisplayValues(values, options = {}) {
  const { unique = false, separator = ', ' } = options;

  let result = (values || [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  if (unique) {
    result = [...new Set(result)];
  }

  return result.join(separator);
}

function buildSchoolEntries(programs) {
  const map = {};
  (programs || []).forEach((program) => {
    if (!map[program.university_slug]) {
      map[program.university_slug] =
        program.display_name || program.university_slug;
    }
  });

  return Object.entries(map)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

function buildEntries(values, labelMap = null) {
  return (values || []).map((value) => ({
    value,
    label: labelMap?.[value] || value
  }));
}

function summarizeSelected(entries, selectedValues, fallback = '全部') {
  const normalizedSelected = (selectedValues || []).map((v) => String(v));
  const selectedSet = new Set(normalizedSelected);
  const allValues = (entries || []).map((item) => String(item.value));
  const allSelected =
    allValues.length > 0 &&
    allValues.length === normalizedSelected.length &&
    allValues.every((value) => selectedSet.has(value));

  if (allSelected) return fallback;

  const selectedLabels = (entries || [])
    .filter((item) => selectedSet.has(String(item.value)))
    .map((item) => item.label);

  if (selectedLabels.length === 0) return fallback;
  if (selectedLabels.length <= 3) return selectedLabels.join('、');
  return `已选 ${selectedLabels.length} 项`;
}

function renderCheckboxDropdown(hostId, entries, selectedValues, fallback = '全部', prefix = '') {
  const host = document.getElementById(hostId);
  if (!host) return;

  const normalizedSelected = (selectedValues || []).map((v) => String(v));
  const selectedSet = new Set(normalizedSelected);
  const allValues = (entries || []).map((item) => String(item.value));
  const allSelected =
    allValues.length > 0 &&
    allValues.length === normalizedSelected.length &&
    allValues.every((value) => selectedSet.has(value));

  const summary = summarizeSelected(entries, selectedValues, fallback);

  host.innerHTML = `
    <div class="filter-dropdown" data-filter-id="${escapeHtml(hostId)}">
      <button type="button" class="filter-dropdown__button">
        <span class="filter-dropdown__label">
          ${
            prefix
              ? `<span class="filter-dropdown__label-prefix">${escapeHtml(prefix)}：</span><span class="filter-dropdown__label-value">${escapeHtml(summary)}</span>`
              : `<span class="filter-dropdown__label-value">${escapeHtml(summary)}</span>`
          }
        </span>
      </button>

      <div class="filter-dropdown__panel">
        <div class="filter-dropdown__list">
          <label
            class="filter-dropdown__row filter-dropdown__row--select-all"
            data-action="toggle-all"
          >
            <input
              class="filter-dropdown__checkbox filter-dropdown__checkbox--select-all"
              type="checkbox"
              ${allSelected ? 'checked' : ''}
            />
            <span>全选</span>
          </label>

          ${
            entries.length
              ? entries.map((item) => `
                <label class="filter-dropdown__row">
                  <input
                    class="filter-dropdown__checkbox"
                    type="checkbox"
                    value="${escapeHtml(item.value)}"
                    ${selectedSet.has(String(item.value)) ? 'checked' : ''}
                  />
                  <span>${escapeHtml(item.label)}</span>
                </label>
              `).join('')
              : `<div class="filter-dropdown__empty">暂无可选项</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderSingleSelectDropdown(hostId, entries, selectedValue, fallback = '请选择', prefix = '') {
  const host = document.getElementById(hostId);
  if (!host) return;

  const normalizedSelected = String(selectedValue || '');
  const selectedEntry =
    (entries || []).find((item) => String(item.value) === normalizedSelected) || null;

  const summary = selectedEntry?.label || fallback;

  host.innerHTML = `
    <div class="filter-dropdown" data-filter-id="${escapeHtml(hostId)}">
      <button type="button" class="filter-dropdown__button">
        <span class="filter-dropdown__label">
          ${
            prefix
              ? `<span class="filter-dropdown__label-prefix">${escapeHtml(prefix)}：</span><span class="filter-dropdown__label-value">${escapeHtml(summary)}</span>`
              : `<span class="filter-dropdown__label-value">${escapeHtml(summary)}</span>`
          }
        </span>
      </button>

      <div class="filter-dropdown__panel">
        <div class="filter-dropdown__list">
          ${
            entries.length
              ? entries.map((item) => `
                <button
                  type="button"
                  class="filter-dropdown__row filter-dropdown__row--single ${String(item.value) === normalizedSelected ? 'is-selected' : ''}"
                  data-single-value="${escapeHtml(item.value)}"
                >
                  <span>${escapeHtml(item.label)}</span>
                </button>
              `).join('')
              : `<div class="filter-dropdown__empty">暂无可选项</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderSortDirectionToggle(hostId, selectedValue = 'asc') {
  const host = document.getElementById(hostId);
  if (!host) return;

  const current = selectedValue === 'desc' ? 'desc' : 'asc';

  host.innerHTML = `
    <div class="sort-direction-toggle" role="group" aria-label="排序方向">
      <button
        type="button"
        class="sort-direction-toggle__btn ${current === 'asc' ? 'is-active' : ''}"
        data-sort-direction="asc"
      >
        升序
      </button>
      <button
        type="button"
        class="sort-direction-toggle__btn ${current === 'desc' ? 'is-active' : ''}"
        data-sort-direction="desc"
      >
        降序
      </button>
    </div>
  `;
}

function normalizeWeightNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

function formatWeightValue(value) {
  const n = normalizeWeightNumber(value, 2);
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

function getScoreWeightMeta(ui) {
  const weights = sanitizeScoreWeights(ui?.scoreWeights || {});
  const factorDefs = getScoreFactorDefs();
  const activeCount = factorDefs.filter((factor) => (weights[factor.key] || 0) > 0).length;
  const rawTotalWeight = factorDefs.reduce(
    (sum, factor) => sum + (Number(weights[factor.key]) || 0),
    0
  );
  const totalWeight = normalizeWeightNumber(rawTotalWeight, 2);
  const hasWeights = hasActiveScoreWeights(weights);

  return { weights, factorDefs, activeCount, totalWeight, hasWeights };
}

function formatWeightShare(value, totalWeight) {
  const n = normalizeWeightNumber(value, 2);
  const total = normalizeWeightNumber(totalWeight, 2);
  if (total <= 0 || n <= 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function updateScoreControlReadouts(ui) {
  const summary = document.getElementById('scorePanelSummary');
  const status = document.getElementById('scoreWeightStatus');
  const { weights, factorDefs, activeCount, totalWeight, hasWeights } = getScoreWeightMeta(ui);

  if (summary) {
    summary.textContent = hasWeights
      ? `已启用 ${activeCount} 个因子，当前绝对权重总和 ${formatWeightValue(totalWeight)}`
      : '仅对学校总分生效，权重为 0 表示不参与评分。';
  }

  if (status) {
    status.classList.toggle('is-warning', !hasWeights);
    status.textContent = hasWeights
      ? `权重总和 ${formatWeightValue(totalWeight)}，各项比例按绝对权重自动计算。`
      : '尚未启用任何权重，表格总分列将保持为空。';
  }

  factorDefs.forEach((factor) => {
    const share = document.querySelector(`[data-score-weight-share-key="${factor.key}"]`);
    if (share) {
      share.textContent = formatWeightShare(weights[factor.key], totalWeight);
    }
  });
}

function renderScoreControls(ui) {
  const grid = document.getElementById('scoreWeightGrid');
  if (!grid) return;

  const { weights, factorDefs, totalWeight } = getScoreWeightMeta(ui);

  grid.innerHTML = factorDefs
    .map((factor) => {
      const currentValue = weights[factor.key] ?? 0;
      const displayValue = formatWeightValue(currentValue);

      return `
        <div class="score-weight-item">
          <div class="score-weight-item__label">
            <span class="score-weight-item__title">${escapeHtml(factor.label)}</span>
            <span
              class="score-weight-item__share"
              data-score-weight-share-key="${escapeHtml(factor.key)}"
            >
              ${escapeHtml(formatWeightShare(currentValue, totalWeight))}
            </span>
          </div>

          <div class="score-weight-item__controls">
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              class="score-weight-item__slider"
              data-score-weight-key="${escapeHtml(factor.key)}"
              value="${escapeHtml(displayValue)}"
              aria-label="${escapeHtml(factor.label)}绝对权重滑杆"
            />
            <div class="score-weight-item__number">
              <input
                type="number"
                min="0"
                step="0.1"
                inputmode="decimal"
                class="score-weight-item__input"
                data-score-weight-key="${escapeHtml(factor.key)}"
                value="${escapeHtml(displayValue)}"
                placeholder="0"
                aria-label="${escapeHtml(factor.label)}绝对权重数值"
              />
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  updateScoreControlReadouts(ui);
}

function bindScoreControlEvents(state, refresh) {
  const ui = state.ui;
  const grid = document.getElementById('scoreWeightGrid');
  const clearBtn = document.getElementById('clearScoreWeightsBtn');
  const recommendedBtn = document.getElementById('recommendedScoreWeightsBtn');

  if (grid) {
    grid.querySelectorAll('[data-score-weight-key]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const target = e.target;
        const key = target.dataset.scoreWeightKey;
        if (!key) return;

        const next = Number(target.value);
        if (!ui.scoreWeights || typeof ui.scoreWeights !== 'object') {
          ui.scoreWeights = getDefaultScoreWeights();
        }

        ui.scoreWeights[key] = Number.isFinite(next) && next >= 0 ? next : 0;

        grid.querySelectorAll(`[data-score-weight-key="${key}"]`).forEach((control) => {
          if (control !== target && control.value !== target.value) {
            control.value = target.value;
          }
        });

        updateScoreControlReadouts(ui);
        renderTable(
          state.filtered,
          ui.sortMetric,
          ui.sortDirection,
          ui.scoreWeights
        );
      });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ui.scoreWeights = getDefaultScoreWeights();
      refresh();
    });
  }

  if (recommendedBtn) {
    recommendedBtn.addEventListener('click', () => {
      ui.scoreWeights = { ...recommendedScoreWeights };
      refresh();
    });
  }
}

function bindDropdownInteractions(hostId, ui, uiKey, refresh) {
  const host = document.getElementById(hostId);
  if (!host) return;

  const dropdown = host.querySelector('.filter-dropdown');
  const button = host.querySelector('.filter-dropdown__button');
  const panel = host.querySelector('.filter-dropdown__panel');
  const list = host.querySelector('.filter-dropdown__list');

  if (!dropdown || !button || !panel || !list) return;

  button.addEventListener('click', (e) => {
    e.stopPropagation();

    const isOpening = !dropdown.classList.contains('is-open');

    document.querySelectorAll('.filter-dropdown.is-open').forEach((el) => {
      if (el !== dropdown) el.classList.remove('is-open');
    });

    dropdown.classList.toggle('is-open', isOpening);
    currentOpenDropdownHostId = isOpening ? hostId : null;
  });

  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  panel.addEventListener('change', (e) => {
    e.stopPropagation();

    dropdownScrollTopMap[hostId] = list.scrollTop;

    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains('filter-dropdown__checkbox')) return;

    const selectAllCheckbox = host.querySelector('.filter-dropdown__checkbox--select-all');
    const itemCheckboxes = [
      ...host.querySelectorAll('.filter-dropdown__checkbox:not(.filter-dropdown__checkbox--select-all)')
    ];

    if (target.classList.contains('filter-dropdown__checkbox--select-all')) {
      const shouldSelectAll = target.checked;

      itemCheckboxes.forEach((input) => {
        input.checked = shouldSelectAll;
      });

      ui[uiKey] = shouldSelectAll
        ? itemCheckboxes.map((input) => input.value)
        : [];
    } else {
      ui[uiKey] = itemCheckboxes
        .filter((input) => input.checked)
        .map((input) => input.value);

      const allChecked =
        itemCheckboxes.length > 0 &&
        itemCheckboxes.every((input) => input.checked);

      if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked;
      }
    }

    currentOpenDropdownHostId = hostId;
    refresh();
  });
}

function bindSingleSelectDropdown(hostId, ui, uiKey, refresh) {
  const host = document.getElementById(hostId);
  if (!host) return;

  const dropdown = host.querySelector('.filter-dropdown');
  const button = host.querySelector('.filter-dropdown__button');
  const panel = host.querySelector('.filter-dropdown__panel');

  if (!dropdown || !button || !panel) return;

  button.addEventListener('click', (e) => {
    e.stopPropagation();

    document.querySelectorAll('.filter-dropdown.is-open').forEach((el) => {
      if (el !== dropdown) el.classList.remove('is-open');
    });

    dropdown.classList.toggle('is-open');
  });

  panel.addEventListener('click', (e) => {
    e.stopPropagation();

    const row = e.target.closest('[data-single-value]');
    if (!row) return;

    ui[uiKey] = row.dataset.singleValue || '';
    if (uiKey === 'sortMetric' && ui[uiKey] === 'total_score') {
      ui.sortDirection = 'desc';
    }
    refresh();
  });
}

function bindSortDirectionToggle(hostId, ui, refresh) {
  const host = document.getElementById(hostId);
  if (!host) return;

  host.querySelectorAll('[data-sort-direction]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const value = btn.dataset.sortDirection;
      if (!value) return;

      ui.sortDirection = value;
      refresh();
    });
  });
}

function isSameSelection(selectedValues, defaultValues) {
  const selected = [...new Set((selectedValues || []).map((v) => String(v)))].sort();
  const defaults = [...new Set((defaultValues || []).map((v) => String(v)))].sort();

  if (selected.length !== defaults.length) return false;
  return selected.every((value, index) => value === defaults[index]);
}

function getDefaultFilterState(programs, mappings) {
  const options = buildFilterOptions(programs, mappings);

  return {
    schools: [...options.schools],
    regions: [...options.regions],
    countries: [...options.countries],
    cities: [...options.cities],
    campuses: [...options.campuses],
    facultyGroups: [...options.facultyGroups],
    durations: [...options.durations],
    types: [...options.types],
    cityScales: [...options.cityScales],
    climates: [...options.climates],
    languages: [...options.languages],
    residencies: [...options.residencies],
    engTaught: ['true']
  };
}

function renderActiveTags(ui, programs, mappings, refresh = null) {
  const container = document.getElementById('activeFilterTags');
  if (!container) return;

  const schoolMap = {};
  (programs || []).forEach((program) => {
    if (!schoolMap[program.university_slug]) {
      schoolMap[program.university_slug] =
        program.display_name || program.university_slug;
    }
  });

  const defaults = getDefaultFilterState(programs, mappings);
  const tags = [];

  if (ui.search) {
    tags.push({
      key: 'search',
      value: ui.search,
      label: `搜索：${ui.search}`
    });
  }

  if (!isSameSelection(ui.engTaught, defaults.engTaught)) {
    (ui.engTaught || []).forEach((v) => {
      const label =
        v === 'true' ? '英授' :
        v === 'false' ? '非英授' :
        '';

      if (label) {
        tags.push({
          key: 'engTaught',
          value: v,
          label: `授课语言：${label}`
        });
      }
    });
  }

  if (!isSameSelection(ui.schools, defaults.schools)) {
    (ui.schools || []).forEach((v) => tags.push({
      key: 'schools',
      value: v,
      label: `大学：${schoolMap[v] || v}`
    }));
  }

  if (!isSameSelection(ui.regions, defaults.regions)) {
    (ui.regions || []).forEach((v) => tags.push({
      key: 'regions',
      value: v,
      label: `地区：${v}`
    }));
  }

  if (!isSameSelection(ui.countries, defaults.countries)) {
    (ui.countries || []).forEach((v) => tags.push({
      key: 'countries',
      value: v,
      label: `国家：${v}`
    }));
  }

  if (!isSameSelection(ui.cities, defaults.cities)) {
    (ui.cities || []).forEach((v) => tags.push({
      key: 'cities',
      value: v,
      label: `城市：${v}`
    }));
  }

  if (!isSameSelection(ui.campuses, defaults.campuses)) {
    (ui.campuses || []).forEach((v) => tags.push({
      key: 'campuses',
      value: v,
      label: `校区：${v}`
    }));
  }

  if (!isSameSelection(ui.facultyGroups, defaults.facultyGroups)) {
    (ui.facultyGroups || []).forEach((v) => tags.push({
      key: 'facultyGroups',
      value: v,
      label: `学院大类：${v}`
    }));
  }

  if (!isSameSelection(ui.durations, defaults.durations)) {
    (ui.durations || []).forEach((v) => tags.push({
      key: 'durations',
      value: v,
      label: `学制：${v}`
    }));
  }

  if (!isSameSelection(ui.types, defaults.types)) {
    (ui.types || []).forEach((v) => tags.push({
      key: 'types',
      value: v,
      label: `类型：${v}`
    }));
  }

  if (!isSameSelection(ui.cityScales, defaults.cityScales)) {
    (ui.cityScales || []).forEach((v) => tags.push({
      key: 'cityScales',
      value: v,
      label: `城市规模：${v}`
    }));
  }

  if (!isSameSelection(ui.climates, defaults.climates)) {
    (ui.climates || []).forEach((v) => tags.push({
      key: 'climates',
      value: v,
      label: `气候：${v}`
    }));
  }

  if (!isSameSelection(ui.languages, defaults.languages)) {
    (ui.languages || []).forEach((v) => tags.push({
      key: 'languages',
      value: v,
      label: `语言环境：${v}`
    }));
  }

  if (!isSameSelection(ui.residencies, defaults.residencies)) {
    (ui.residencies || []).forEach((v) => tags.push({
      key: 'residencies',
      value: v,
      label: `居留：${v}`
    }));
  }

  container.innerHTML = tags
    .map((tag) => `
      <button
        type="button"
        class="filter-tag filter-tag--removable"
        data-tag-key="${escapeHtml(tag.key)}"
        data-tag-value="${escapeHtml(tag.value)}"
      >
        <span class="filter-tag__text">${escapeHtml(tag.label)}</span>
        <span class="filter-tag__remove">×</span>
      </button>
    `)
    .join('');

  if (!refresh) return;

  container.querySelectorAll('[data-tag-key]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const key = btn.dataset.tagKey;
      const value = btn.dataset.tagValue;

      if (!key) return;

      if (key === 'search') {
        ui.search = '';
      } else if (Array.isArray(ui[key])) {
        ui[key] = ui[key].filter((item) => String(item) !== String(value));
      }

      refresh();
    });
  });
}

function renderStatsList(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = `<div class="empty-state">暂无数据</div>`;
    return;
  }

  const max = Math.max(...items.map((item) => item.count), 1);

  el.innerHTML = items
    .map((item) => {
      const width = Math.max(6, Math.round((item.count / max) * 100));
      return `
        <div class="stat-row">
          <div class="stat-row__label">${escapeHtml(item.label)}</div>
          <div class="stat-row__bar">
            <div class="stat-row__fill" style="width:${width}%"></div>
          </div>
          <div class="stat-row__value">${item.count}</div>
        </div>
      `;
    })
    .join('');
}

function countBy(list, getKey) {
  const map = new Map();

  (list || []).forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });

  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
}

function getRepresentativeProgram(programs) {
  return (
    (programs || []).find((p) => (p.campus_list || [])[0] === '主校区') ||
    (programs || []).find((p) => (p.campus_list || []).includes('主校区')) ||
    (programs || [])[0] ||
    null
  );
}

function getRepresentativeLocation(programs) {
  const items = Array.isArray(programs) ? programs : [];

  const mainCampusLocation = items
    .flatMap((program) => Array.isArray(program?.location_items) ? program.location_items : [])
    .find((item) => String(item?.campus || '').trim() === '主校区');

  if (mainCampusLocation) {
    return mainCampusLocation;
  }

  const firstProgram = items[0] || null;
  const firstLocation = Array.isArray(firstProgram?.location_items)
    ? firstProgram.location_items[0] || null
    : null;

  return firstLocation || null;
}

function buildProgramLocation(program) {
  const items = (program?.location_items || []).map((item) => ({
    city: item.city || '',
    country: item.country || '',
    region: item.region || '',
    cityScale: item.city_scale || '',
    climate: item.climate || '',
    language: item.language || '',
    residency: item.residency || ''
  }));

  return {
    items,
    city: joinDisplayValues(items.map((item) => item.city), { unique: true }),
    country: joinDisplayValues(items.map((item) => item.country), { unique: true }),
    region: joinDisplayValues(items.map((item) => item.region), { unique: true }),
    cityScale: joinDisplayValues(items.map((item) => item.cityScale), { unique: true }),
    climate: joinDisplayValues(items.map((item) => item.climate), { unique: true }),
    language: joinDisplayValues(items.map((item) => item.language), { unique: true }),
    residency: joinDisplayValues(items.map((item) => item.residency), { unique: true })
  };
}

function compareSchools(a, b, metric, direction) {
  switch (metric) {
    case 'manifest_order':
      return compareNullableNumber(a.manifest_order, b.manifest_order, direction);

    case 'total_score':
      return compareNullableNumber(a.total_score, b.total_score, direction);

    case 'qs':
      return compareNullableNumber(a.qs, b.qs, direction);

    case 'the':
      return compareNullableNumber(a.the, b.the, direction);

    case 'usnews':
      return compareNullableNumber(a.usnews, b.usnews, direction);

    case 'city':
      return compareNullableText(a.sort_city, b.sort_city, direction);

    case 'country':
      return compareNullableText(a.sort_country, b.sort_country, direction);

    case 'region':
      return compareNullableText(a.sort_region, b.sort_region, direction);

    case 'city_scale': {
      const byOrder = compareNullableNumber(a.sort_city_scale_order, b.sort_city_scale_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(a.sort_city_scale, b.sort_city_scale, direction);
    }

    case 'climate': {
      const byOrder = compareNullableNumber(a.sort_climate_order, b.sort_climate_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(a.sort_climate, b.sort_climate, direction);
    }

    case 'language': {
      const byOrder = compareNullableNumber(a.sort_language_order, b.sort_language_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(a.sort_language, b.sort_language, direction);
    }

    case 'residency': {
      const byOrder = compareNullableNumber(a.sort_residency_order, b.sort_residency_order, direction);
      if (byOrder !== 0) return byOrder;
      return compareNullableText(a.sort_residency, b.sort_residency, direction);
    }

    default:
      return compareNullableNumber(a.manifest_order, b.manifest_order, direction);
  }
}
function sortSchools(schools, metric = 'manifest_order', direction = 'asc') {
  return [...(schools || [])].sort((a, b) => {
    const primary = compareSchools(a, b, metric, direction);
    if (primary !== 0) return primary;

    const tie1 = compareNullableNumber(a.manifest_order, b.manifest_order, 'asc');
    if (tie1 !== 0) return tie1;

    return compareNullableText(
      a.display_name || a.university_slug,
      b.display_name || b.university_slug,
      'asc'
    );
  });
}

function groupProgramsByUniversity(programs) {
  const map = new Map();

  (programs || []).forEach((program) => {
    const slug = program.university_slug;
    if (!map.has(slug)) {
      map.set(slug, []);
    }
    map.get(slug).push(program);
  });

  return [...map.entries()].map(([slug, items]) => {
    const first = items[0];
    const representativeProgram = getRepresentativeProgram(items);
    const representativeLocation = getRepresentativeLocation(items);

    return {
      university_slug: slug,
      display_name: first.display_name || slug,
      uni_color: first.uni_color || '',
      manifest_order: first.manifest_order,
      qs: first.qs,
      the: first.the,
      usnews: first.usnews,
      representativeProgram,
      representativeLocation,
      programs: items,

      sort_city: representativeLocation?.city || '',
      sort_country: representativeLocation?.country || '',
      sort_region: representativeLocation?.region || '',
      sort_city_scale: representativeLocation?.city_scale || '',
      sort_climate: representativeLocation?.climate || '',
      sort_language: representativeLocation?.language || '',
      sort_residency: representativeLocation?.residency || '',

      sort_city_scale_order: representativeLocation?.city_scale_order ?? null,
      sort_climate_order: representativeLocation?.climate_order ?? null,
      sort_language_order: representativeLocation?.language_order ?? null,
      sort_residency_order: representativeLocation?.residency_order ?? null
    };
  });
}

function buildLocationPayload(location) {
  const items = Array.isArray(location?.items)
    ? location.items
    : location
      ? [location]
      : [];

  return encodeURIComponent(JSON.stringify(items));
}

function renderLocationDetailCards(locations) {
  const items = Array.isArray(locations) ? locations.filter(Boolean) : [];

  if (!items.length) {
    return `
      <section class="detail-section">
        <div class="detail-section__head">
          <h4 class="detail-section__title">环境与适配</h4>
        </div>
        <div class="empty-state">暂无地区信息</div>
      </section>
    `;
  }

  return items.map((location) => `
    <section class="detail-section detail-section--location-card">
      <div class="detail-section__head">
        <div class="detail-location-hero">
          <h4 class="detail-location-hero__title">${escapeHtml(location.city || '地区信息')}</h4>
          <p class="detail-location-hero__subtitle">
            ${escapeHtml(
              [location.country, location.region].filter(Boolean).join(' · ')
            )}
          </p>
        </div>
      </div>

      <dl class="detail-meta-grid">
        <div class="detail-meta-item">
          <dt>城市规模</dt>
          <dd>${escapeHtml(location.cityScale || '')}</dd>
        </div>

        <div class="detail-meta-item">
          <dt>气候</dt>
          <dd>${escapeHtml(location.climate || '')}</dd>
        </div>

        <div class="detail-meta-item">
          <dt>语言环境</dt>
          <dd>${escapeHtml(location.language || '')}</dd>
        </div>

        <div class="detail-meta-item">
          <dt>居留</dt>
          <dd>${escapeHtml(location.residency || '')}</dd>
        </div>
      </dl>
    </section>
  `).join('');
}

function bindLocationTriggers() {
  document.querySelectorAll('.location-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const payload = btn.dataset.location;
      if (!payload) return;
      const locations = JSON.parse(decodeURIComponent(payload));
      const renderedInSidePanel = renderLocationScene(locations);
      if (!renderedInSidePanel) {
        openLocationDialog(locations);
      }
    });
  });
}

function openLocationDialog(locations) {
  const dialog = document.getElementById('locationDetailDialog');
  const body = document.getElementById('locationDetailBody');
  if (!dialog || !body) return;

  const items = Array.isArray(locations) ? locations.filter(Boolean) : [];

  body.innerHTML = renderLocationDetailCards(items);

  dialog.classList.add('is-visible');

  if (typeof dialog.show === 'function') {
    if (!dialog.open) dialog.show();
  } else {
    dialog.setAttribute('open', 'open');
  }
}

function formatUniversityDisplayName(displayName) {
  const raw = String(displayName || '').trim();
  if (!raw) return '';

  const match = raw.match(/^(.*)\(([A-Za-z0-9._-]+)\)$/);
  if (!match) return raw;

  const mainName = String(match[1] || '').trim();
  const slugText = String(match[2] || '').trim();

  if (!mainName || !slugText) return raw;
  return `${mainName}<br>${slugText}`;
}

function getUniversityColorClass(uniColor) {
  const normalized = String(uniColor || '').trim().toLowerCase();

  if (normalized === 'red') return 'school-name--red';
  if (normalized === 'orange') return 'school-name--orange';
  if (normalized === 'green') return 'school-name--green';
  if (normalized === 'blue') return 'school-name--blue';
  if (normalized === 'gray') return 'school-name--gray';

  return '';
}

function renderProgramLink(programName, url) {
  if (!programName) return '';

  return url
    ? `<a class="program-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(programName)}</a>`
    : escapeHtml(programName);
}

function renderRankingBlock(qs, the, usnews) {
  const entries = [
    ['QS', qs],
    ['THE', the],
    ['US News', usnews]
  ];

  return `
    <div class="ranking-block">
      ${entries.map(([label, value]) => `
        <div class="ranking-block__item">
          <span class="ranking-block__label">${escapeHtml(label)}</span>
          <span class="ranking-block__value">${escapeHtml(value ?? '-')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLocationMiniCard(location, options = {}) {
  const { className = '' } = options;
  const city = String(location?.city || '').trim();
  const subtitle = [location?.country, location?.region]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' · ');

  if (!city && !subtitle) {
    return '<span class="location-mini-card location-mini-card--empty">-</span>';
  }

  return `
    <button
      type="button"
      class="location-mini-card ${escapeHtml(className)} location-trigger"
      data-location="${buildLocationPayload(location)}"
    >
      <span class="location-mini-card__city">${escapeHtml(city || '地点')}</span>
      <span class="location-mini-card__subtitle">${escapeHtml(subtitle)}</span>
    </button>
  `;
}

function renderLocationMiniCardList(locations, options = {}) {
  const items = (Array.isArray(locations) ? locations : [])
    .filter(Boolean)
    .filter((item) => item.city || item.country || item.region);

  if (!items.length) {
    return '<span class="location-mini-card location-mini-card--empty">-</span>';
  }

  return `
    <div class="location-mini-card-list">
      ${items.map((item) => renderLocationMiniCard(item, options)).join('')}
    </div>
  `;
}

function renderLivingConditionCard(location) {
  const entries = [
    ['\u57ce\u5e02\u89c4\u6a21', location?.city_scale],
    ['\u6c14\u5019', location?.climate],
    ['\u8bed\u8a00\u73af\u5883', location?.language],
    ['\u5c45\u7559', location?.residency]
  ];

  return `
    <div class="living-condition-card">
      ${entries.map(([label, value]) => `
        <div class="living-condition-card__item">
          <span class="living-condition-card__label">${escapeHtml(label)}</span>
          <span class="living-condition-card__value">${escapeHtml(String(value || '').trim() || '-')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function formatProgramDuration(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/年|year|yr|semester|term/i.test(raw)) return raw;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return `${Number.isInteger(n) ? n : raw}年`;
  }

  return raw;
}

function formatProgramEnglishTaught(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return '英授';
  if (['false', 'no', 'n', '0'].includes(normalized)) return '非英授';
  return textYesNo(value || '') || '';
}

function getProgramAttributeItems(program) {
  return [
    formatProgramDuration(program?.duration || ''),
    formatProgramEnglishTaught(program?.eng_taught || ''),
    String(program?.type || '').trim()
  ].filter(Boolean);
}

function renderProgramAttributeList(program) {
  const items = getProgramAttributeItems(program);

  if (!items.length) return '-';

  return `
    <div class="program-attribute-list">
      ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
  `;
}

function renderSchoolMainRow(school, rank) {
  const location = school.representativeLocation || null;
  const locationItems = location ? [location] : [];
  const isExpanded = expandedUniversitySet.has(school.university_slug);
  const programCount = (school.programs || []).length;
  const scoreValue = Number.isFinite(school.total_score) ? school.total_score.toFixed(1) : '';

  return `
    <tr
      class="school-row school-summary-row ${isExpanded ? 'is-expanded' : ''}"
      data-university-slug="${escapeHtml(school.university_slug)}"
    >
      <td class="school-summary-cell school-summary-cell--identity">
        <div class="school-summary">
          <div class="school-summary__rank">
            <span class="row-toggle" aria-hidden="true">${isExpanded ? '-' : '+'}</span>
            <span>${rank}</span>
          </div>
          <div class="school-summary__main">
            <span class="school-name ${escapeHtml(getUniversityColorClass(school.uni_color))}">
              ${formatUniversityDisplayName(escapeHtml(school.display_name))}
            </span>
            <div class="school-summary__meta">
              <span>${programCount} 个项目</span>
            </div>
          </div>
        </div>
      </td>

      <td class="school-summary-cell">
        ${renderLocationMiniCardList(locationItems, { className: 'location-mini-card--school' })}
      </td>

      <td class="school-summary-cell school-summary-cell--living">
        ${renderLivingConditionCard(location)}
      </td>

      <td class="school-summary-cell school-summary-cell--ranking">
        ${renderRankingBlock(school.qs, school.the, school.usnews)}
      </td>

      <td class="school-summary-cell score-cell">
        ${scoreValue ? `<span class="score-text">${escapeHtml(scoreValue)}</span>` : '<span class="score-empty">-</span>'}
      </td>
    </tr>
  `;
}

function renderProgramContinuationRows(school) {
  if (!expandedUniversitySet.has(school.university_slug)) return '';

  const cards = (school.programs || [])
    .map((program) => {
      const location = buildProgramLocation(program);

      return `
        <article class="program-card">
          <div class="program-card__head">
            <div class="program-card__eyebrow">本科项目</div>
            <h3 class="program-card__title">${renderProgramLink(program.program, program.url)}</h3>
          </div>

          <dl class="program-card__grid">
            <div class="program-card__item program-card__item--wide">
              <dt>学院</dt>
              <dd>${escapeHtml(joinDisplayValues(program.faculty_list || [], { unique: true }) || '-')}</dd>
            </div>
            <div class="program-card__item program-card__item--wide">
              <dt>校区</dt>
              <dd>${escapeHtml(joinDisplayValues(program.campus_list || [], { unique: true }) || '-')}</dd>
            </div>
            <div class="program-card__item program-card__item--location-attributes">
              <div class="program-card__location">
                <dt>地点</dt>
                <dd>${renderLocationMiniCardList(location.items, { className: 'location-mini-card--program' })}</dd>
              </div>
              <div class="program-card__attributes">
                <dt>属性</dt>
                <dd>${renderProgramAttributeList(program)}</dd>
              </div>
            </div>
          </dl>
        </article>
      `;
    })
    .join('');

  return `
    <tr class="program-row program-row--expanded">
      <td colspan="5" class="program-cards-cell">
        <div class="program-card-list">
          ${cards || '<div class="empty-state">暂无项目明细</div>'}
        </div>
      </td>
    </tr>
  `;
}

export function renderFilterOptions(programs, ui, mappings) {
  const options = buildFilterOptions(programs, mappings);

  renderCheckboxDropdown(
    'cityScaleSelect',
    buildEntries(options.cityScales),
    ui.cityScales,
    '全部',
    '城市规模'
  );

  renderCheckboxDropdown(
    'climateSelect',
    buildEntries(options.climates),
    ui.climates,
    '全部',
    '气候'
  );

  renderCheckboxDropdown(
    'languageSelect',
    buildEntries(options.languages),
    ui.languages,
    '全部',
    '语言环境'
  );

  renderCheckboxDropdown(
    'residencySelect',
    buildEntries(options.residencies),
    ui.residencies,
    '全部',
    '居留'
  );

  renderCheckboxDropdown(
    'regionSelect',
    buildEntries(options.regions),
    ui.regions,
    '全部',
    '地区'
  );

  renderCheckboxDropdown(
    'countrySelect',
    buildEntries(options.countries),
    ui.countries,
    '全部',
    '国家'
  );

  renderCheckboxDropdown(
    'citySelect',
    buildEntries(options.cities),
    ui.cities,
    '全部',
    '城市'
  );

  renderCheckboxDropdown(
    'schoolSelect',
    buildSchoolEntries(programs),
    ui.schools,
    '全部',
    '大学'
  );

  renderCheckboxDropdown(
    'campusSelect',
    buildEntries(options.campuses),
    ui.campuses,
    '全部',
    '校区'
  );

  renderCheckboxDropdown(
    'facultySelect',
    buildEntries(options.facultyGroups),
    ui.facultyGroups,
    '全部',
    '学院大类'
  );

  renderCheckboxDropdown(
    'durationSelect',
    buildEntries(options.durations),
    ui.durations,
    '全部',
    '学制'
  );

  renderCheckboxDropdown(
    'typeSelect',
    buildEntries(options.types),
    ui.types,
    '全部',
    '类型'
  );

  renderCheckboxDropdown(
    'engTaughtSelect',
    [
      { value: 'true', label: '英授' },
      { value: 'false', label: '非英授' }
    ],
    ui.engTaught,
    '全部',
    '授课语言'
  );

  renderSingleSelectDropdown(
    'sortMetricSelect',
    [
      { value: 'manifest_order', label: '排位' },
      { value: 'total_score', label: '总分' },
      { value: 'qs', label: 'QS' },
      { value: 'the', label: 'THE' },
      { value: 'usnews', label: 'US News' },
      { value: 'city', label: '城市' },
      { value: 'country', label: '国家' },
      { value: 'region', label: '地区' },
      { value: 'city_scale', label: '城市规模' },
      { value: 'climate', label: '气候' },
      { value: 'language', label: '语言环境' },
      { value: 'residency', label: '居留' }
    ],
    ui.sortMetric,
    '请选择',
    '排序指标'
  );

  renderSortDirectionToggle('sortDirectionToggle', ui.sortDirection);

  renderScoreControls(ui);

  const searchInput = document.getElementById('searchInput');
  if (searchInput && searchInput.value !== (ui.search || '')) {
    searchInput.value = ui.search || '';
  }

  if (currentOpenDropdownHostId) {
    const openHost = document.getElementById(currentOpenDropdownHostId);
    const openDropdown = openHost?.querySelector('.filter-dropdown');
    const openList = openHost?.querySelector('.filter-dropdown__list');

    if (openDropdown) {
      openDropdown.classList.add('is-open');
    }

    if (openList) {
      requestAnimationFrame(() => {
        openList.scrollTop = dropdownScrollTopMap[currentOpenDropdownHostId] || 0;
      });
    }
  }

  renderActiveTags(ui, programs, mappings, window.__ug_refresh__);
}

export function renderSummary(filteredPrograms, allPrograms) {
  const filtered = filteredPrograms || [];
  const schoolCount = new Set(filtered.map((p) => p.university_slug)).size;

  setText('resultCount', `${schoolCount} 所大学 / ${filtered.length} 个项目`);
  setText('overviewSchoolCount', schoolCount);
  setText('overviewProgramCount', filtered.length);

  renderStatsList(
    'regionStats',
    countBy(filtered.flatMap((p) => p.region_list || []), (v) => v)
  );

  renderStatsList(
    'cityScaleStats',
    countBy(filtered.flatMap((p) => p.city_scale_list || []), (v) => v)
  );

  renderStatsList(
    'climateStats',
    countBy(filtered.flatMap((p) => p.climate_list || []), (v) => v)
  );

  renderStatsList(
    'languageStats',
    countBy(filtered.flatMap((p) => p.language_list || []), (v) => v)
  );

  renderStatsList(
    'residencyStats',
    countBy(filtered.flatMap((p) => p.residency_list || []), (v) => v)
  );

  renderStatsList(
    'facultyGroupStats',
    countBy(filtered.flatMap((p) => p.faculty_group_list || []), (v) => v)
  );
}

export function renderTable(
  programs,
  sortMetric = 'manifest_order',
  sortDirection = 'asc',
  scoreWeights = null
) {
  const tbody = document.getElementById('programTableBody');
  if (!tbody) return;

  const groupedSchools = groupProgramsByUniversity(programs);
  const scoredSchools = computeSchoolScores(groupedSchools, scoreWeights);
  const schools = sortSchools(scoredSchools, sortMetric, sortDirection);

  if (!schools.length) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5" class="table-empty">没有匹配结果</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = schools
    .map((school, index) => {
      return (
        renderSchoolMainRow(school, index + 1) +
        renderProgramContinuationRows(school)
      );
    })
    .join('');

  tbody.querySelectorAll('.school-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('a, button')) return;

      const slug = row.dataset.universitySlug;
      if (!slug) return;

      if (expandedUniversitySet.has(slug)) {
        expandedUniversitySet.delete(slug);
      } else {
        expandedUniversitySet.add(slug);
      }

      renderTable(programs, sortMetric, sortDirection, scoreWeights);
    });
  });

  bindLocationTriggers();
}

function resetUiState(ui, programs, mappings) {
  const options = buildFilterOptions(programs, mappings);

  ui.search = '';

  ui.schools = [...options.schools];
  ui.regions = [...options.regions];
  ui.countries = [...options.countries];
  ui.cities = [...options.cities];
  ui.campuses = [...options.campuses];
  ui.facultyGroups = [...options.facultyGroups];
  ui.durations = [...options.durations];
  ui.types = [...options.types];
  ui.cityScales = [...options.cityScales];
  ui.climates = [...options.climates];
  ui.languages = [...options.languages];
  ui.residencies = [...options.residencies];

  ui.engTaught = ['true'];

  ui.sortMetric = 'manifest_order';
  ui.sortDirection = 'asc';
  ui.scoreWeights = getDefaultScoreWeights();
}

const THEME_STORAGE_KEY = 'ug_theme_mode';

function getSystemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

function getSavedThemeMode() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'auto') {
    return saved;
  }
  return null;
}

function getEffectiveTheme(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return getSystemPrefersDark() ? 'dark' : 'light';
}

function applyTheme(mode) {
  const effectiveTheme = getEffectiveTheme(mode);

  document.body.classList.toggle('dark', effectiveTheme === 'dark');
  document.body.dataset.themeMode = mode;

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute(
      'aria-label',
      mode === 'auto' ? '主题：跟随系统' :
      mode === 'dark' ? '主题：深色' :
      '主题：浅色'
    );

    themeToggleBtn.setAttribute(
      'title',
      mode === 'auto' ? '主题：跟随系统' :
      mode === 'dark' ? '主题：深色' :
      '主题：浅色'
    );

    themeToggleBtn.textContent =
      mode === 'auto' ? '自' :
      mode === 'dark' ? '深' :
      '浅';
  }
}

function initTheme() {
  const savedMode = getSavedThemeMode();
  const initialMode = savedMode || 'auto';
  applyTheme(initialMode);

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (media) {
    const handleSystemThemeChange = () => {
      const currentMode = getSavedThemeMode() || 'auto';
      if (currentMode === 'auto') {
        applyTheme('auto');
      }
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleSystemThemeChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleSystemThemeChange);
    }
  }
}

function cycleThemeMode() {
  const currentMode = getSavedThemeMode() || 'auto';
  const nextMode =
    currentMode === 'auto' ? 'dark' :
    currentMode === 'dark' ? 'light' :
    'auto';

  localStorage.setItem(THEME_STORAGE_KEY, nextMode);
  applyTheme(nextMode);
}

export function bindStaticEvents(state, refresh) {
  const ui = state.ui;
  window.__ug_refresh__ = refresh;
  renderLocationScene([]);

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      ui.search = e.target.value;
      refresh();
    });
  }

  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      resetUiState(ui, state.normalized, state.rawLoaded?.mappings);
      refresh();
    });
  }

  const closeLocationDetailBtn = document.getElementById('closeLocationDetailBtn');
  const locationDialog = document.getElementById('locationDetailDialog');

  if (closeLocationDetailBtn && locationDialog) {
    closeLocationDetailBtn.addEventListener('click', () => {
      locationDialog.classList.remove('is-visible');
      if (typeof locationDialog.close === 'function') {
        locationDialog.close();
      } else {
        locationDialog.removeAttribute('open');
      }
    });

    locationDialog.addEventListener('click', (e) => {
      if (e.target === locationDialog) {
        locationDialog.classList.remove('is-visible');
        if (typeof locationDialog.close === 'function') {
          locationDialog.close();
        } else {
          locationDialog.removeAttribute('open');
        }
      }
    });
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.filter-dropdown.is-open').forEach((el) => {
      el.classList.remove('is-open');
    });
    currentOpenDropdownHostId = null;
  });

  const themeToggleBtn = document.getElementById('themeToggleBtn');

  initTheme();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      cycleThemeMode();
    });
  }
}

export function bindDynamicFilterEvents(state, refresh) {
  const ui = state.ui;

  [
    ['cityScaleSelect', 'cityScales'],
    ['climateSelect', 'climates'],
    ['languageSelect', 'languages'],
    ['residencySelect', 'residencies'],
    ['regionSelect', 'regions'],
    ['countrySelect', 'countries'],
    ['citySelect', 'cities'],
    ['schoolSelect', 'schools'],
    ['campusSelect', 'campuses'],
    ['facultySelect', 'facultyGroups'],
    ['durationSelect', 'durations'],
    ['typeSelect', 'types'],
    ['engTaughtSelect', 'engTaught']
  ].forEach(([hostId, uiKey]) => {
    bindDropdownInteractions(hostId, ui, uiKey, refresh);
  });

  bindSingleSelectDropdown('sortMetricSelect', ui, 'sortMetric', refresh);
  bindSortDirectionToggle('sortDirectionToggle', ui, refresh);
  bindScoreControlEvents(state, refresh);
}
