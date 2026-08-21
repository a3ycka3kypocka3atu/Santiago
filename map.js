(function () {
  'use strict';

  const PRAGUE_VIEW = [50.0755, 14.4378];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function slug(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  function newTabAttributes(url) {
    return /^https?:\/\//i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
  }

  function verifiedCoordinates(record, kind) {
    if (!Array.isArray(record.coordinates) || record.coordinates.length !== 2) return null;
    const coordinates = record.coordinates.map(Number);
    if (!coordinates.every(Number.isFinite)) return null;
    if (Math.abs(coordinates[0]) > 90 || Math.abs(coordinates[1]) > 180) return null;
    if (kind === 'place' && String(record.status || '').toLowerCase() !== 'active') return null;
    return coordinates;
  }

  function entryFrom(record, kind) {
    const coordinates = verifiedCoordinates(record, kind);
    return {
      id: `${kind}-${record.id}`,
      kind,
      name: record.name || record.title,
      description: record.shortDescription || record.description || '',
      city: record.city || '',
      country: record.country || '',
      topicIds: record.topicIds || [],
      status: record.status || (record.onlineAvailability ? 'Available by contact' : ''),
      url: kind === 'practitioner' ? record.profileUrl : record.detailUrl,
      contactUrl: record.contactUrl,
      coordinates,
      precision: coordinates ? 'Verified public map position' : 'List only—no verified public map point'
    };
  }

  function initialise() {
    const data = window.LumeyaData;
    const status = document.getElementById('map-status');
    const mapElement = document.getElementById('discovery-map');
    const listElement = document.getElementById('map-list-panel');
    if (!data || !status || !mapElement || !listElement) {
      if (status) status.textContent = 'Map data is temporarily unavailable.';
      return;
    }

    const entries = [
      ...data.practitioners.map((record) => entryFrom(record, 'practitioner')),
      ...data.places
        .filter((record) => String(record.status || '').toLowerCase() === 'active')
        .map((record) => entryFrom(record, 'place'))
    ];
    const topicMap = new Map((data.topics || []).map((topic) => [topic.id, topic.label]));
    const citySelect = document.getElementById('map-city-filter');
    const topicSelect = document.getElementById('map-topic-filter');
    const typeSelect = document.getElementById('map-type-filter');

    Array.from(new Set(entries.map((entry) => entry.city).filter(Boolean))).sort().forEach((city) => {
      citySelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(slug(city))}">${escapeHtml(city)}</option>`);
    });
    (data.topics || []).forEach((topic) => {
      topicSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.label)}</option>`);
    });

    let map = null;
    let markerLayer = null;
    const markerById = new Map();
    if (window.L) {
      map = window.L.map(mapElement, { scrollWheelZoom: false }).setView(PRAGUE_VIEW, 11);
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      markerLayer = window.L.layerGroup().addTo(map);
    }

    function matches(entry) {
      const city = citySelect.value;
      const topic = topicSelect.value;
      const type = typeSelect.value;
      return (city === 'all' || slug(entry.city) === city)
        && (topic === 'all' || entry.topicIds.includes(topic))
        && (type === 'all' || entry.kind === type);
    }

    function card(entry) {
      const topics = entry.topicIds.map((id) => topicMap.get(id)).filter(Boolean).slice(0, 3);
      const links = [
        entry.url ? `<a href="${escapeHtml(entry.url)}">View ${escapeHtml(entry.kind)}</a>` : '',
        entry.contactUrl ? `<a href="${escapeHtml(entry.contactUrl)}"${newTabAttributes(entry.contactUrl)}>Contact</a>` : ''
      ].filter(Boolean).join('');
      return `<article class="entity-card" data-map-entry="${escapeHtml(entry.id)}">
        <div class="entity-card__topline"><span class="status-pill">${escapeHtml(entry.kind)}</span><span class="entity-tag">${escapeHtml(entry.precision)}</span></div>
        <h2>${escapeHtml(entry.name)}</h2>
        <p>${escapeHtml(entry.description)}</p>
        <dl class="entity-card__facts"><div class="entity-card__fact"><dt>Location</dt><dd>${escapeHtml([entry.city, entry.country].filter(Boolean).join(', ') || 'Not public')}</dd></div></dl>
        <div class="tag-list">${topics.map((label) => `<span class="entity-tag">${escapeHtml(label)}</span>`).join('')}</div>
        <div class="entity-card__links">${links}</div>
      </article>`;
    }

    function render() {
      const visible = entries.filter(matches);
      listElement.innerHTML = visible.length ? visible.map(card).join('') : '<div class="state-card"><strong>No matching locations</strong><span>Try another city, topic or listing type.</span></div>';
      markerById.clear();

      if (map && markerLayer) {
        markerLayer.clearLayers();
        const bounds = [];
        visible.filter((entry) => entry.coordinates).forEach((entry) => {
          const icon = window.L.divIcon({
            className: '',
            html: `<span class="map-marker map-marker--${entry.kind}" aria-hidden="true">${entry.kind === 'place' ? '⌂' : 'P'}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });
          const marker = window.L.marker(entry.coordinates, { icon, title: entry.name }).bindPopup(
            `<strong>${escapeHtml(entry.name)}</strong><br>${escapeHtml(entry.kind)} · ${escapeHtml(entry.precision)}<br>${entry.url ? `<a href="${escapeHtml(entry.url)}">Open details</a>` : ''}`
          );
          marker.addTo(markerLayer);
          markerById.set(entry.id, marker);
          bounds.push(entry.coordinates);
        });
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        else if (bounds.length === 1) map.setView(bounds[0], 12);
      }

      const mapped = visible.filter((entry) => entry.coordinates).length;
      status.textContent = visible.length
        ? `${visible.length} result${visible.length === 1 ? '' : 's'} · ${mapped} verified public map position${mapped === 1 ? '' : 's'}. Listings without verified coordinates remain list-only.`
        : 'No matching practitioners or places.';

      listElement.querySelectorAll('[data-map-entry]').forEach((element) => {
        element.addEventListener('click', (event) => {
          if (event.target.closest('a')) return;
          const marker = markerById.get(element.dataset.mapEntry);
          if (marker && map) {
            document.getElementById('show-map-view').click();
            map.setView(marker.getLatLng(), 13);
            marker.openPopup();
          }
        });
      });
    }

    [citySelect, topicSelect, typeSelect].forEach((control) => control.addEventListener('change', render));

    const mapButton = document.getElementById('show-map-view');
    const listButton = document.getElementById('show-list-view');
    const mapPanel = document.getElementById('map-panel');
    function setView(view) {
      const showMap = view === 'map';
      mapPanel.hidden = !showMap;
      listElement.hidden = showMap;
      mapButton.setAttribute('aria-pressed', String(showMap));
      listButton.setAttribute('aria-pressed', String(!showMap));
      if (showMap && map) window.setTimeout(() => map.invalidateSize(), 0);
    }
    mapButton.addEventListener('click', () => setView('map'));
    listButton.addEventListener('click', () => setView('list'));

    render();
    const hasVerifiedMapPoint = entries.some((entry) => entry.coordinates);
    setView(window.matchMedia('(max-width: 640px)').matches || !hasVerifiedMapPoint ? 'list' : 'map');
  }

  document.addEventListener('DOMContentLoaded', initialise);
})();
