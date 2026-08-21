(function (root) {
  'use strict';

  var initialized = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
  }

  function safeUrl(value) {
    var url = String(value || '').trim();
    if (!url || /^javascript:/i.test(url) || /^data:/i.test(url)) return '';
    if (/^(https?:\/\/|\/|\.\.?\/|#)/i.test(url)) return url;
    return /^[a-z0-9][a-z0-9._/-]*(?:[?#].*)?$/i.test(url) ? url : '';
  }

  function newTabAttributes(url) {
    return /^https?:\/\//i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
  }

  function initials(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join('') || 'L';
  }

  function fact(label, value) {
    return '<div class="entity-card__fact"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value || 'Not published') + '</dd></div>';
  }

  function linkedFact(label, records, labelField, urlField) {
    if (!records.length) return '';
    var links = records.map(function (record) {
      var url = safeUrl(record[urlField]);
      return url
        ? '<a href="' + escapeHtml(url) + '">' + escapeHtml(record[labelField]) + '</a>'
        : '<span>' + escapeHtml(record[labelField]) + '</span>';
    });
    return '<div class="entity-card__fact"><dt>' + escapeHtml(label) + '</dt><dd>' + links.join(', ') + '</dd></div>';
  }

  function locationText(place) {
    if (place.city === 'Online') return 'Online';
    return [place.city, place.country].filter(Boolean).join(', ') || 'Not published';
  }

  function precisionText(place) {
    if (!Array.isArray(place.coordinates) || place.coordinates.length !== 2) return 'No verified public map point';
    if (place.locationPrecision === 'none') return 'No physical map point';
    return place.locationPrecision === 'verified' ? 'Verified public map point' : 'Public map point';
  }

  function renderCard(place, data) {
    var topics = data.related(place, 'topics', 'topicIds');
    var practitioners = data.related(place, 'practitioners', 'practitionerIds');
    var services = data.related(place, 'services', 'serviceIds');
    var formats = data.related(place, 'eventFormats', 'eventFormatIds');
    var detailUrl = safeUrl(place.detailUrl);
    var mapUrl = safeUrl(place.mapUrl);
    var contactUrl = safeUrl(place.contactUrl);
    var titleId = 'place-' + escapeHtml(place.id) + '-title';
    var actions = [];

    if (detailUrl && detailUrl !== 'space.html#place-' + place.id) {
      actions.push('<a class="entity-card__action" href="' + escapeHtml(detailUrl) + '" aria-label="View details for ' + escapeHtml(place.name) + '">View details</a>');
    }
    if (mapUrl) {
      actions.push('<a class="entity-card__action" href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Open a map for ' + escapeHtml(place.name) + '">Open map</a>');
    }
    if (contactUrl) {
      actions.push('<a class="button button--primary" href="' + escapeHtml(contactUrl) + '"' + newTabAttributes(contactUrl) + ' aria-label="' + escapeHtml(place.contactLabel + ' about ' + place.name) + '">' + escapeHtml(place.contactLabel) + '</a>');
    }

    return '<article class="entity-card" data-place-id="' + escapeHtml(place.id) + '" aria-labelledby="' + titleId + '">' +
      '<div class="entity-card__visual" aria-hidden="true">' + escapeHtml(initials(place.name)) + '</div>' +
      '<div class="entity-card__topline"><span class="status-pill">' + escapeHtml(place.status) + '</span><span class="entity-tag">' + escapeHtml(place.type) + '</span></div>' +
      '<h2 id="' + titleId + '">' + escapeHtml(place.name) + '</h2>' +
      '<p>' + escapeHtml(place.description) + '</p>' +
      '<div class="tag-list" aria-label="Topics">' + topics.map(function (topic) { return '<span class="entity-tag">' + escapeHtml(topic.label) + '</span>'; }).join('') + '</div>' +
      '<dl class="entity-card__facts">' +
        fact('Location', locationText(place)) +
        fact('Address', place.address || (place.city === 'Online' ? 'Not applicable' : 'Not publicly listed')) +
        fact('Map detail', precisionText(place)) +
        linkedFact('Practitioners', practitioners, 'name', 'profileUrl') +
        linkedFact('Services', services, 'title', 'detailUrl') +
        linkedFact('Formats', formats, 'title', 'detailUrl') +
      '</dl>' +
      '<div class="entity-card__links">' + actions.join('') + '</div>' +
    '</article>';
  }

  function boot() {
    if (initialized || !root.LumeyaData) return;
    var grid = document.getElementById('spaces-grid');
    if (!grid) return;
    initialized = true;

    var data = root.LumeyaData;
    var search = document.querySelector('#spaces-search, #places-search, [data-discovery-search="places"]');
    var cityFilter = document.querySelector('#spaces-city-filter, [data-place-filter="city"]');
    var statusFilter = document.querySelector('#spaces-status-filter, [data-place-filter="status"]');
    var typeFilter = document.querySelector('#spaces-type-filter, [data-place-filter="type"]');
    var sortControl = document.getElementById('spaces-sort');
    var empty = document.getElementById('spaces-empty');
    var reset = document.querySelector('#spaces-reset-filters, #reset-space-filters');
    var count = document.querySelector('#spaces-results-count, [data-results-count="places"]');

    function haystack(place) {
      var topics = data.related(place, 'topics', 'topicIds').map(function (topic) { return topic.label; });
      var people = data.related(place, 'practitioners', 'practitionerIds').map(function (person) { return person.name; });
      var services = data.related(place, 'services', 'serviceIds').map(function (service) { return service.title; });
      return normalize([
        place.name,
        place.description,
        place.type,
        place.status,
        place.city,
        place.country,
        topics.join(' '),
        people.join(' '),
        services.join(' ')
      ].join(' '));
    }

    function render() {
      var query = normalize(search && search.value);
      var city = normalize(cityFilter && cityFilter.value);
      var status = normalize(statusFilter && statusFilter.value);
      var type = normalize(typeFilter && typeFilter.value);
      var visible = data.places.filter(function (place) {
        return (!query || haystack(place).indexOf(query) !== -1) &&
          (!city || city === 'all' || normalize(place.city) === city) &&
          (!status || status === 'all' || normalize(place.status) === status) &&
          (!type || type === 'all' || normalize(place.type).indexOf(type) !== -1);
      });

      if (sortControl && sortControl.value === 'title') {
        visible.sort(function (a, b) { return a.name.localeCompare(b.name); });
      } else if (sortControl && sortControl.value === 'city') {
        visible.sort(function (a, b) { return String(a.city).localeCompare(String(b.city)); });
      }

      grid.innerHTML = visible.map(function (place) { return renderCard(place, data); }).join('');
      if (empty) empty.hidden = visible.length !== 0;
      if (count) count.textContent = visible.length + (visible.length === 1 ? ' place' : ' places');
    }

    [search, cityFilter, statusFilter, typeFilter, sortControl].forEach(function (control) {
      if (!control) return;
      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', render);
    });

    if (reset) {
      reset.addEventListener('click', function () {
        if (search) search.value = '';
        if (cityFilter) cityFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (typeFilter) typeFilter.value = 'all';
        if (sortControl) sortControl.value = 'default';
        render();
        if (search) search.focus();
      });
    }

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('lumeya:data-ready', boot);
})(window);
