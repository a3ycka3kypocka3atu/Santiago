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

  function safeUrl(value) {
    var url = String(value || '').trim();
    if (!url || /^javascript:/i.test(url) || /^data:/i.test(url)) return '';
    if (/^(https?:\/\/|\/|\.\.?\/|#)/i.test(url)) return url;
    return /^[a-z0-9][a-z0-9._/-]*(?:[?#].*)?$/i.test(url) ? url : '';
  }

  function newTabAttributes(url) {
    return /^https?:\/\//i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
  }

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
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

  function recordLink(record, labelField, urlField) {
    var url = safeUrl(record && record[urlField]);
    if (!record || !url) return record ? '<span>' + escapeHtml(record[labelField]) + '</span>' : '';
    return '<a href="' + escapeHtml(url) + '">' + escapeHtml(record[labelField]) + '</a>';
  }

  function relationshipRow(label, items) {
    if (!items.length) return '';
    return '<div class="entity-card__fact"><dt>' + escapeHtml(label) + '</dt><dd>' + items.join(', ') + '</dd></div>';
  }

  function renderCard(service, data) {
    var practitioners = data.related(service, 'practitioners', 'practitionerIds');
    var places = data.related(service, 'places', 'placeIds');
    var formats = data.related(service, 'eventFormats', 'eventFormatIds');
    var topics = data.related(service, 'topics', 'topicIds');
    var detailUrl = safeUrl(service.detailUrl);
    var contactUrl = safeUrl(service.contactUrl);
    var titleId = 'service-' + escapeHtml(service.id) + '-title';
    var links = [];

    if (detailUrl) {
      links.push('<a class="entity-card__action" href="' + escapeHtml(detailUrl) + '" aria-label="View details for ' + escapeHtml(service.title) + '">View details</a>');
    }
    if (contactUrl) {
      links.push('<a class="button button--primary" href="' + escapeHtml(contactUrl) + '"' + newTabAttributes(contactUrl) + ' aria-label="' + escapeHtml(service.contactLabel + ' about ' + service.title) + '">' + escapeHtml(service.contactLabel) + '</a>');
    }

    return '<article class="entity-card" data-service-id="' + escapeHtml(service.id) + '" aria-labelledby="' + titleId + '">' +
      '<div class="entity-card__visual" aria-hidden="true">' + escapeHtml(initials(service.title)) + '</div>' +
      '<div class="entity-card__topline"><span class="status-pill">' + escapeHtml(service.status) + '</span><span class="entity-tag">' + escapeHtml(service.format) + '</span></div>' +
      '<h2 id="' + titleId + '">' + escapeHtml(service.title) + '</h2>' +
      '<p>' + escapeHtml(service.description) + '</p>' +
      '<div class="tag-list" aria-label="Topics">' + topics.map(function (topic) { return '<span class="entity-tag">' + escapeHtml(topic.label) + '</span>'; }).join('') + '</div>' +
      '<dl class="entity-card__facts">' +
        fact('Price', service.price) +
        fact('Duration', service.duration) +
        fact('Delivery', service.delivery) +
        fact('Location', service.location) +
        fact('Provider', service.provider) +
        relationshipRow('Practitioner', practitioners.map(function (record) { return recordLink(record, 'name', 'profileUrl'); })) +
        relationshipRow('Place', places.map(function (record) { return recordLink(record, 'name', 'detailUrl'); })) +
        relationshipRow('Event format', formats.map(function (record) { return recordLink(record, 'title', 'detailUrl'); })) +
      '</dl>' +
      '<div class="entity-card__links">' + links.join('') + '</div>' +
    '</article>';
  }

  function serviceCategory(service) {
    var topics = service.topicIds || [];
    if (topics.some(function (id) { return ['bodywork', 'rehabilitation', 'wellness', 'aromatherapy'].indexOf(id) !== -1; })) return 'body';
    if (topics.some(function (id) { return ['mind-body', 'lila', 'relationships', 'personal-development'].indexOf(id) !== -1; })) return 'mind';
    if (topics.some(function (id) { return ['media', 'business', 'community'].indexOf(id) !== -1; })) return 'incubator';
    return 'other';
  }

  function matchesStatus(service, value) {
    if (!value || value === 'all') return true;
    if (value === 'online') return normalize(service.delivery).indexOf('online') !== -1;
    if (value === 'available') return normalize(service.status) === 'available';
    return normalize(service.status) === value;
  }

  function matchesFormat(service, value) {
    if (!value || value === 'all') return true;
    var format = normalize(service.format);
    if (value === 'b2b') return format.indexOf('team') !== -1;
    return format.indexOf(value) !== -1;
  }

  function boot() {
    if (initialized || !root.LumeyaData) return;
    var grid = document.getElementById('services-grid');
    if (!grid) return;
    initialized = true;

    var data = root.LumeyaData;
    var services = data.services.slice();
    var search = document.querySelector('#services-search, #service-search, [data-discovery-search="services"]');
    var statusFilter = document.querySelector('#services-status-filter, [data-service-filter="status"]');
    var formatFilter = document.querySelector('#services-format-filter, [data-service-filter="format"]');
    var providerFilter = document.getElementById('provider-filter');
    var sortControl = document.getElementById('services-sort');
    var legacyFilters = document.getElementById('services-filters');
    var reset = document.querySelector('#services-reset-filters, #reset-filters');
    var empty = document.getElementById('services-empty');
    var count = document.querySelector('#services-results-count, [data-results-count="services"]');
    var category = 'all';

    function searchText(service) {
      var relatedNames = data.related(service, 'practitioners', 'practitionerIds').map(function (record) { return record.name; });
      var topicNames = data.related(service, 'topics', 'topicIds').map(function (record) { return record.label; });
      return normalize([
        service.title,
        service.description,
        service.status,
        service.format,
        service.delivery,
        service.location,
        service.provider,
        relatedNames.join(' '),
        topicNames.join(' ')
      ].join(' '));
    }

    function render() {
      var query = normalize(search && search.value);
      var status = statusFilter ? statusFilter.value : 'all';
      var format = formatFilter ? formatFilter.value : 'all';
      var provider = normalize(providerFilter && providerFilter.value);
      var visible = services.filter(function (service) {
        var providerText = normalize(service.provider + ' ' + service.practitionerIds.join(' '));
        var matchesProvider = !provider || provider === 'all' || providerText.indexOf(provider) !== -1;
        return (!query || searchText(service).indexOf(query) !== -1) &&
          matchesStatus(service, status) &&
          matchesFormat(service, format) &&
          matchesProvider &&
          (category === 'all' || serviceCategory(service) === category);
      });

      if (sortControl && sortControl.value === 'title') {
        visible.sort(function (a, b) { return a.title.localeCompare(b.title); });
      } else if (sortControl && sortControl.value === 'provider') {
        visible.sort(function (a, b) { return a.provider.localeCompare(b.provider); });
      }

      grid.innerHTML = visible.map(function (service) { return renderCard(service, data); }).join('');
      if (empty) empty.hidden = visible.length !== 0;
      if (count) count.textContent = visible.length + (visible.length === 1 ? ' service' : ' services');
    }

    [search, statusFilter, formatFilter, providerFilter, sortControl].forEach(function (control) {
      if (!control) return;
      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', render);
    });

    if (legacyFilters) {
      legacyFilters.addEventListener('click', function (event) {
        var button = event.target.closest && event.target.closest('[data-filter]');
        if (!button || !legacyFilters.contains(button)) return;
        var filterName = button.getAttribute('data-filter');
        var value = button.getAttribute('data-value') || button.value || 'all';
        if (filterName === 'category') category = value;
        if (filterName === 'format' && formatFilter) formatFilter.value = value;
        legacyFilters.querySelectorAll('[data-filter="' + filterName + '"]').forEach(function (item) {
          var active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', String(active));
        });
        render();
      });
    }

    if (reset) {
      reset.addEventListener('click', function () {
        if (search) search.value = '';
        if (statusFilter) statusFilter.value = 'all';
        if (formatFilter) formatFilter.value = 'all';
        if (providerFilter) providerFilter.value = 'all';
        if (sortControl) sortControl.value = 'default';
        category = 'all';
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
