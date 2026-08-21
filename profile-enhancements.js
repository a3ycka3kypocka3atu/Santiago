(function (root) {
  'use strict';

  var initialized = false;
  var aliases = {
    ivan: 'ivan-protinak',
    'ivan-protinak': 'ivan-protinak',
    katerina: 'katerina',
    violetta: 'violetta-blago',
    'violetta-blago': 'violetta-blago',
    andrij: 'andrij-pycha',
    'andrij-pycha': 'andrij-pycha'
  };

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

  function fact(label, value) {
    return '<div class="entity-card__fact"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value || 'Not published') + '</dd></div>';
  }

  function linkedList(records, labelField, urlField, suffix) {
    if (!records.length) return '<p>No linked records are published.</p>';
    return '<ul>' + records.map(function (record) {
      var url = safeUrl(record[urlField]);
      var label = escapeHtml(record[labelField]);
      var link = url ? '<a href="' + escapeHtml(url) + '">' + label + '</a>' : '<span>' + label + '</span>';
      return '<li>' + link + (suffix ? '<small>' + escapeHtml(suffix(record)) + '</small>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function boot() {
    if (initialized || !root.LumeyaData) return;
    var mount = document.getElementById('profile-discovery-data');
    var bodyKey = document.body && document.body.getAttribute('data-practitioner');
    if (!mount || !bodyKey) return;

    var data = root.LumeyaData;
    var practitioner = data.getById('practitioners', aliases[bodyKey] || bodyKey);
    if (!practitioner) {
      mount.classList.add('profile-discovery');
      mount.innerHTML = '<p role="status">Normalized practitioner information is not available for this profile.</p>';
      initialized = true;
      return;
    }
    initialized = true;

    var services = data.related(practitioner, 'services', 'serviceIds');
    var places = data.related(practitioner, 'places', 'placeIds');
    var formats = data.related(practitioner, 'eventFormats', 'eventFormatIds');
    var topics = data.related(practitioner, 'topics', 'topicIds');
    var contactUrl = safeUrl(practitioner.contactUrl);
    var contact = contactUrl
      ? '<a class="button button--primary" href="' + escapeHtml(contactUrl) + '"' + newTabAttributes(contactUrl) + ' aria-label="' + escapeHtml(practitioner.contactLabel + ' about ' + practitioner.name) + '">' + escapeHtml(practitioner.contactLabel) + '</a>'
      : '<span>Contact route not published</span>';

    mount.classList.add('profile-discovery');
    mount.setAttribute('aria-labelledby', 'profile-discovery-heading');
    mount.innerHTML =
      '<h2 id="profile-discovery-heading">Discovery information</h2>' +
      '<p>' + escapeHtml(practitioner.approach) + '</p>' +
      '<div class="tag-list" aria-label="Topics">' + topics.map(function (topic) { return '<span class="entity-tag">' + escapeHtml(topic.label) + '</span>'; }).join('') + '</div>' +
      '<div class="profile-discovery__grid">' +
        '<article class="section-card" aria-labelledby="profile-facts-heading">' +
          '<h3 id="profile-facts-heading">At a glance</h3>' +
          '<dl class="entity-card__facts">' +
            fact('Fields', practitioner.fields.join(', ')) +
            fact('Location', practitioner.location) +
            fact('Languages', practitioner.languages.length ? practitioner.languages.join(', ') : 'Not published') +
            (practitioner.onlineAvailability && practitioner.onlineAvailability !== 'Not published' ? fact('Online', practitioner.onlineAvailability) : '') +
            fact('Experience', practitioner.experience) +
            (practitioner.image ? fact('Photo', 'Provider supplied') : '') +
          '</dl>' +
          '<div class="entity-card__links">' + contact + '</div>' +
        '</article>' +
        '<article class="section-card" aria-labelledby="profile-services-heading">' +
          '<h3 id="profile-services-heading">Linked services</h3>' +
          linkedList(services, 'title', 'detailUrl', function (service) { return service.status + ' · ' + service.price; }) +
        '</article>' +
        '<article class="section-card" aria-labelledby="profile-context-heading">' +
          '<h3 id="profile-context-heading">Connected places' + (formats.length ? ' and event formats' : '') + '</h3>' +
          '<h4>Places</h4>' +
          linkedList(places, 'name', 'detailUrl', function (place) { return place.status + ' · ' + place.city; }) +
          (formats.length ? '<h4>Event formats</h4>' + linkedList(formats, 'title', 'detailUrl', function (format) { return 'Format only · no confirmed date · ' + format.status; }) : '') +
        '</article>' +
      '</div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('lumeya:data-ready', boot);
})(window);
