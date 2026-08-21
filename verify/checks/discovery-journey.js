'use strict';

const vm = require('vm');
const { readText } = require('../lib/util');

function loadData(errors) {
  const context = { window: {} };
  try {
    vm.runInNewContext(readText('discovery-data.js'), context, { filename: 'discovery-data.js' });
  } catch (error) {
    errors.push(`discovery-data.js: could not execute (${error.message})`);
    return null;
  }
  return context.window.LumeyaData || null;
}

module.exports = {
  name: 'journey',
  description: 'factual service → practitioner → place → contact vertical slice is connected',

  run() {
    const errors = [];
    const warnings = [];
    const data = loadData(errors);
    if (!data) return { errors, warnings, info: { recordsChecked: 0 } };

    const service = data.getById('services', 'deep-massage');
    const practitioner = data.getById('practitioners', 'ivan-protinak');
    const place = data.getById('places', 'santiago-studio-praha');
    const expected = [
      ['service', service],
      ['practitioner', practitioner],
      ['place', place],
    ];
    expected.forEach(([label, record]) => {
      if (!record) errors.push(`missing core ${label} record`);
    });
    if (!service || !practitioner || !place) {
      return { errors, warnings, info: { recordsChecked: expected.filter(([, value]) => value).length } };
    }

    if (!service.practitionerIds.includes(practitioner.id)) errors.push('core service does not reference Ivan');
    if (!practitioner.serviceIds.includes(service.id)) errors.push('Ivan does not reference the core service');
    if (!service.placeIds.includes(place.id)) errors.push('core service does not reference Santiago Studio');
    if (!place.serviceIds.includes(service.id)) errors.push('Santiago Studio does not reference the core service');
    if (!practitioner.placeIds.includes(place.id)) errors.push('Ivan does not reference Santiago Studio');
    if (!place.practitionerIds.includes(practitioner.id)) errors.push('Santiago Studio does not reference Ivan');

    if (service.detailUrl !== 'offer.html') errors.push('core service detail route is not offer.html');
    if (practitioner.profileUrl !== 'profile.html') errors.push('core practitioner route is not profile.html');
    if (place.detailUrl !== 'space.html#place-santiago-studio-praha') errors.push('core place route is not the published place anchor');

    [service, practitioner, place].forEach((record) => {
      if (!String(record.contactUrl || '').startsWith('suggest.html?')) {
        errors.push(`${record.id}: contact must preserve context through the public request page`);
      }
    });

    const nonActivePlaces = data.places.filter((record) => String(record.status).toLowerCase() !== 'active');
    if (nonActivePlaces.length) errors.push('conceptual or inactive places remain in the public place dataset');

    const mapSource = readText('map.js');
    if (/approximateCoordinates|CITY_CENTRES|Approximate city-level position/.test(mapSource)) {
      errors.push('map.js still generates synthetic city-level coordinates');
    }
    if (!/verifiedCoordinates/.test(mapSource)) errors.push('map.js does not enforce verified coordinates');

    const offer = readText('offer.html');
    const profile = readText('profile.html');
    const space = readText('space.html');
    if (!/href="profile\.html"/.test(offer)) errors.push('offer.html does not link to Ivan profile');
    if (!/href="space\.html#place-santiago-studio-praha"/.test(offer)) errors.push('offer.html does not link to Santiago Studio');
    if (!/href="suggest\.html\?/.test(offer)) errors.push('offer.html does not link to the contextual request flow');
    if (!/href="space\.html#place-santiago-studio-praha"/.test(profile)) errors.push('profile.html does not link to Santiago Studio');
    if (!/id="place-santiago-studio-praha"/.test(space)) errors.push('space.html is missing the published place anchor');

    return { errors, warnings, info: { recordsChecked: 3 } };
  },
};
