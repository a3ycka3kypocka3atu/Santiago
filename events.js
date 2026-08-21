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

  function actionLinks(record, noun) {
    var links = [];
    var detailUrl = safeUrl(record.detailUrl || record.url);
    var contactUrl = safeUrl(record.contactUrl);
    if (detailUrl) {
      links.push('<a class="entity-card__action" href="' + escapeHtml(detailUrl) + '" aria-label="View details for ' + escapeHtml(record.title) + '">View details</a>');
    }
    if (contactUrl) {
      links.push('<a class="button button--primary" href="' + escapeHtml(contactUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="' + escapeHtml((record.contactLabel || 'Ask on Telegram') + ' about ' + record.title) + '">' + escapeHtml(record.contactLabel || 'Ask on Telegram') + '</a>');
    }
    return '<div class="entity-card__links" aria-label="' + escapeHtml(noun) + ' actions">' + links.join('') + '</div>';
  }

  function renderFormatCard(format, data) {
    var topics = data.related(format, 'topics', 'topicIds');
    var practitioners = data.related(format, 'practitioners', 'practitionerIds');
    var places = data.related(format, 'places', 'placeIds');
    var services = data.related(format, 'services', 'serviceIds');
    var titleId = 'format-' + escapeHtml(format.id) + '-title';

    return '<article class="entity-card" data-event-format-id="' + escapeHtml(format.id) + '" aria-labelledby="' + titleId + '">' +
      '<div class="entity-card__visual" aria-hidden="true">' + escapeHtml(initials(format.title)) + '</div>' +
      '<div class="entity-card__topline"><span class="status-pill">Event format · no confirmed date</span><span class="entity-tag">' + escapeHtml(format.status) + '</span></div>' +
      '<h3 id="' + titleId + '">' + escapeHtml(format.title) + '</h3>' +
      '<p>' + escapeHtml(format.description) + '</p>' +
      '<div class="tag-list" aria-label="Topics">' + topics.map(function (topic) { return '<span class="entity-tag">' + escapeHtml(topic.label) + '</span>'; }).join('') + '</div>' +
      '<dl class="entity-card__facts">' +
        fact('Format', format.format) +
        fact('Location', format.location) +
        fact('Organiser', format.organizer) +
        fact('Date', 'No scheduled date published') +
        linkedFact('People', practitioners, 'name', 'profileUrl') +
        linkedFact('Places', places, 'name', 'detailUrl') +
        linkedFact('Services', services, 'title', 'detailUrl') +
      '</dl>' +
      actionLinks(format, 'Event format') +
    '</article>';
  }

  function scheduledDate(eventRecord) {
    var raw = eventRecord.start || eventRecord.startAt || eventRecord.date || '';
    if (!raw) return 'Not published';
    var date = new Date(raw);
    if (Number.isNaN(date.getTime())) return String(raw);
    try {
      return new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: eventRecord.allDay ? undefined : 'short'
      }).format(date);
    } catch (error) {
      return date.toLocaleString('en');
    }
  }

  function renderScheduledCard(eventRecord) {
    var id = eventRecord.id || normalize(eventRecord.title);
    var titleId = 'scheduled-event-' + escapeHtml(id) + '-title';
    return '<article class="entity-card" data-scheduled-event-id="' + escapeHtml(id) + '" aria-labelledby="' + titleId + '">' +
      '<div class="entity-card__topline"><span class="status-pill">Verified scheduled event</span></div>' +
      '<h3 id="' + titleId + '">' + escapeHtml(eventRecord.title || 'Scheduled event') + '</h3>' +
      (eventRecord.description ? '<p>' + escapeHtml(eventRecord.description) + '</p>' : '') +
      '<dl class="entity-card__facts">' +
        fact('When', scheduledDate(eventRecord)) +
        fact('Location', eventRecord.location) +
        fact('Organiser', eventRecord.organizer) +
        fact('Status', eventRecord.status || 'Confirmed') +
      '</dl>' +
      actionLinks(eventRecord, 'Scheduled event') +
    '</article>';
  }

  function legacyStatus(format) {
    var status = normalize(format.status);
    if (status.indexOf('concept') !== -1 || status.indexOf('development') !== -1 || status.indexOf('forming') !== -1) return 'concept';
    if (status.indexOf('available') !== -1 || status.indexOf('recurring') !== -1) return 'regular';
    return status;
  }

  function formatCategory(format) {
    var topics = format.topicIds || [];
    if (topics.indexOf('relationships') !== -1) return 'relationships';
    if (topics.indexOf('media') !== -1) return 'media';
    if (topics.indexOf('business') !== -1) return 'projects';
    return 'community';
  }

  function boot() {
    if (initialized || !root.LumeyaData) return;
    var formatsGrid = document.getElementById('formats-grid') || document.getElementById('events-grid');
    if (!formatsGrid) return;
    initialized = true;

    var data = root.LumeyaData;
    var scheduledGrid = document.getElementById('scheduled-events');
    var state = document.getElementById('events-state');
    var empty = document.getElementById('events-empty');
    var search = document.querySelector('#events-search, #formats-search, [data-discovery-search="events"]');
    var categoryFilter = document.querySelector('#events-category-filter, [data-event-filter="category"]');
    var statusFilter = document.querySelector('#events-status-filter, [data-event-filter="status"]');
    var ownerFilter = document.querySelector('#events-owner-filter, [data-event-filter="owner"]');
    var sortControl = document.getElementById('events-sort');
    var reset = document.querySelector('#events-reset-filters, #reset-event-filters');

    function formatText(format) {
      var topics = data.related(format, 'topics', 'topicIds').map(function (topic) { return topic.label; });
      var people = data.related(format, 'practitioners', 'practitionerIds').map(function (person) { return person.name; });
      return normalize([
        format.title,
        format.description,
        format.status,
        format.format,
        format.location,
        format.organizer,
        topics.join(' '),
        people.join(' ')
      ].join(' '));
    }

    function renderFormats() {
      var query = normalize(search && search.value);
      var category = normalize(categoryFilter && categoryFilter.value);
      var selectedStatus = normalize(statusFilter && statusFilter.value);
      var owner = normalize(ownerFilter && ownerFilter.value);
      var visible = data.eventFormats.filter(function (format) {
        return (!query || formatText(format).indexOf(query) !== -1) &&
          (!category || category === 'all' || formatCategory(format) === category) &&
          (!selectedStatus || selectedStatus === 'all' || legacyStatus(format) === selectedStatus) &&
          (!owner || owner === 'all' || normalize(format.organizer).indexOf(owner) !== -1);
      });

      if (sortControl && sortControl.value === 'title') {
        visible.sort(function (a, b) { return a.title.localeCompare(b.title); });
      } else if (sortControl && sortControl.value === 'owner') {
        visible.sort(function (a, b) { return a.organizer.localeCompare(b.organizer); });
      }

      formatsGrid.innerHTML = visible.map(function (format) { return renderFormatCard(format, data); }).join('');
      if (empty) empty.hidden = visible.length !== 0;
    }

    function setScheduleState(status, events, message) {
      var records = Array.isArray(events) ? events : [];
      if (scheduledGrid) {
        scheduledGrid.innerHTML = records.map(renderScheduledCard).join('');
        scheduledGrid.hidden = records.length === 0;
      }
      if (!state) return;

      state.classList.remove('state-card--unavailable', 'state-card--success');
      if (status === 'ready' && records.length) {
        state.hidden = true;
        return;
      }

      state.hidden = false;
      if (status === 'loading') {
        state.innerHTML = '<strong>Loading scheduled events</strong><span>Checking the live event source.</span>';
      } else if (status === 'ready') {
        state.classList.add('state-card--success');
        state.innerHTML = '<strong>No verified scheduled events are published</strong><span>Event formats below are ideas or request-based formats, not confirmed dates.</span>';
      } else {
        state.classList.add('state-card--unavailable');
        state.innerHTML = '<strong>Events temporarily unavailable</strong><span>' + escapeHtml(message || 'The live event source is not connected. Event formats below remain available for discovery.') + '</span>';
      }
    }

    function acceptSchedule(detail) {
      detail = detail || {};
      var records = Array.isArray(detail) ? detail : detail.events;
      var status = Array.isArray(detail) ? 'ready' : (detail.status || (Array.isArray(records) ? 'ready' : 'unavailable'));
      setScheduleState(status, records, detail.message);
    }

    [search, categoryFilter, statusFilter, ownerFilter, sortControl].forEach(function (control) {
      if (!control) return;
      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', renderFormats);
    });

    if (reset) {
      reset.addEventListener('click', function () {
        if (search) search.value = '';
        if (categoryFilter) categoryFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (ownerFilter) ownerFilter.value = 'all';
        if (sortControl) sortControl.value = 'default';
        renderFormats();
        if (search) search.focus();
      });
    }

    document.addEventListener('lumeya:scheduled-events', function (event) { acceptSchedule(event.detail); });
    document.addEventListener('lumeya:events-state', function (event) { acceptSchedule(event.detail); });

    renderFormats();
    if (data.scheduledEvents.length) {
      setScheduleState('ready', data.scheduledEvents);
    } else if (root.LumeyaEventsProvider && typeof root.LumeyaEventsProvider.load === 'function') {
      setScheduleState('loading');
      Promise.resolve(root.LumeyaEventsProvider.load()).then(function (events) {
        setScheduleState('ready', events);
      }).catch(function () {
        setScheduleState('unavailable', [], 'The live event source could not be reached. Event formats below remain available for discovery.');
      });
    } else {
      setScheduleState('unavailable', [], 'The live event source is not connected. No scheduled event is being claimed. Event formats below remain available for discovery.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('lumeya:data-ready', boot);
})(window);
