import { escapeHtml } from './utils.js';

const sceneState = {
  items: [],
  activeIndex: 0
};

function normalizeLocations(locations) {
  return (Array.isArray(locations) ? locations : [])
    .filter(Boolean)
    .map((location) => ({
      city: String(location.city || '').trim(),
      country: String(location.country || '').trim(),
      region: String(location.region || '').trim(),
      cityScale: String(location.cityScale || '').trim(),
      climate: String(location.climate || '').trim(),
      language: String(location.language || '').trim(),
      residency: String(location.residency || '').trim()
    }));
}

function getActiveLocation() {
  if (!sceneState.items.length) return null;
  return sceneState.items[sceneState.activeIndex] || sceneState.items[0] || null;
}

function renderLocationCard(location, modifier = '') {
  const subtitle = [location.country, location.region].filter(Boolean).join(' · ');
  const cardClass = ['location-card', modifier].filter(Boolean).join(' ');

  return `
    <article class="${cardClass}">
      <div class="location-card__head">
        <h3 class="location-card__title">${escapeHtml(location.city || location.country || location.region || '地点信息')}</h3>
        <p class="location-card__subtitle">${escapeHtml(subtitle)}</p>
      </div>

      <dl class="location-card__meta">
        <div class="location-card__meta-item">
          <dt>城市规模</dt>
          <dd>${escapeHtml(location.cityScale || '-')}</dd>
        </div>
        <div class="location-card__meta-item">
          <dt>气候</dt>
          <dd>${escapeHtml(location.climate || '-')}</dd>
        </div>
        <div class="location-card__meta-item">
          <dt>语言环境</dt>
          <dd>${escapeHtml(location.language || '-')}</dd>
        </div>
        <div class="location-card__meta-item">
          <dt>居留</dt>
          <dd>${escapeHtml(location.residency || '-')}</dd>
        </div>
      </dl>
    </article>
  `;
}

function renderSceneStage(active) {
  const dialog = active
    ? `
      <div class="location-scene__dialog location-scene__dialog--active">
        ${renderLocationCard(active, 'location-card--floating')}
      </div>
    `
    : '<div class="location-scene__empty empty-state">暂未选择地点</div>';

  const marker = active
    ? '<span class="location-scene__marker location-scene__marker--active"></span>'
    : `
      <span class="location-scene__marker location-scene__marker--one"></span>
      <span class="location-scene__marker location-scene__marker--two"></span>
    `;

  const arrow = active ? '<span class="location-scene__arrow"></span>' : '';

  return `
    <div class="location-scene__stage">
      <div class="location-scene__globe" aria-hidden="true">
        <span class="location-scene__globe-core"></span>
      </div>

      <div class="location-scene__marker-layer" aria-hidden="true">
        ${marker}
      </div>

      <div class="location-scene__arrow-layer" aria-hidden="true">
        ${arrow}
      </div>

      <div class="location-scene__dialog-stack">
        ${dialog}
      </div>
    </div>
  `;
}

function renderEmptyScene(mount, summary) {
  if (summary) {
    summary.textContent = '点击表格中的城市 / 国家 / 地区查看';
  }

  mount.innerHTML = `
    <div class="location-scene location-scene--empty">
      ${renderSceneStage(null)}
    </div>
  `;
}

function bindSceneButtons(mount) {
  mount.querySelectorAll('[data-location-scene-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (sceneState.items.length <= 1) return;

      const direction = btn.dataset.locationSceneAction === 'next' ? 1 : -1;
      sceneState.activeIndex =
        (sceneState.activeIndex + direction + sceneState.items.length) % sceneState.items.length;
      renderLocationScene(sceneState.items, { preserveIndex: true });
    });
  });
}

export function renderLocationScene(locations, options = {}) {
  const mount = document.getElementById('locationSceneMount');
  const summary = document.getElementById('locationSceneSummary');
  if (!mount) return false;

  const nextItems = normalizeLocations(locations);
  sceneState.items = nextItems;

  if (!options.preserveIndex) {
    sceneState.activeIndex = 0;
  } else if (sceneState.activeIndex >= sceneState.items.length) {
    sceneState.activeIndex = 0;
  }

  if (!sceneState.items.length) {
    renderEmptyScene(mount, summary);
    return true;
  }

  const active = getActiveLocation();
  const count = sceneState.items.length;
  const activeLabel = active?.city || active?.country || active?.region || '地点';

  if (summary) {
    summary.textContent = count > 1
      ? `${activeLabel} · ${sceneState.activeIndex + 1} / ${count}`
      : activeLabel;
  }

  mount.innerHTML = `
    <div class="location-scene">
      ${renderSceneStage(active)}

      <div class="location-scene__controls" aria-label="地点卡片切换">
        <button
          type="button"
          class="location-scene__nav"
          data-location-scene-action="prev"
          ${count <= 1 ? 'disabled' : ''}
        >
          上一张
        </button>
        <span class="location-scene__counter">${sceneState.activeIndex + 1} / ${count}</span>
        <button
          type="button"
          class="location-scene__nav"
          data-location-scene-action="next"
          ${count <= 1 ? 'disabled' : ''}
        >
          下一张
        </button>
      </div>
    </div>
  `;

  bindSceneButtons(mount);
  return true;
}
