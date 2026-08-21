(function (root) {
  'use strict';

  var topics = [
    { id: 'bodywork', label: 'Bodywork' },
    { id: 'rehabilitation', label: 'Rehabilitation' },
    { id: 'wellness', label: 'Wellness' },
    { id: 'aromatherapy', label: 'Aromatherapy' },
    { id: 'mind-body', label: 'Mind-body practice' },
    { id: 'lila', label: 'Lila' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'personal-development', label: 'Personal development' },
    { id: 'media', label: 'Media production' },
    { id: 'business', label: 'Business and automation' },
    { id: 'community', label: 'Community' }
  ];

  var services = [
    {
      id: 'deep-massage',
      slug: 'deep-massage',
      title: 'Deep Massage & Tea Ceremony',
      description: 'A bodywork session with Ivan followed by a quiet tea ceremony.',
      status: 'By request',
      duration: 'Massage duration is not published; the tea ceremony is 30–60 minutes',
      format: 'Individual',
      delivery: 'In person',
      location: 'Santiago Studio, Prague',
      price: '1200 CZK · approximately 48–50 EUR',
      topicIds: ['bodywork', 'rehabilitation'],
      practitionerIds: ['ivan-protinak'],
      placeIds: ['santiago-studio-praha'],
      eventFormatIds: [],
      provider: 'Ivan Protinyak',
      detailUrl: 'offer.html',
      contactUrl: 'suggest.html?topic=Deep%20Massage%20%26%20Tea%20Ceremony&details=I%20would%20like%20to%20ask%20about%20the%20Deep%20Massage%20%26%20Tea%20Ceremony%20with%20Ivan%20Protinyak%20at%20Santiago%20Studio%20in%20Prague.&city=Prague&preference=in_person#looking-for',
      contactLabel: 'Request this service'
    },
    {
      id: 'wellness-programmes',
      slug: 'wellness-programmes',
      title: 'Wellness Programs & SPA Retreats',
      description: 'Wellness programmes combining body practices, aromatherapy and SPA retreat formats.',
      status: 'By request',
      duration: 'Varies by programme',
      format: 'Individual or group',
      delivery: 'In person; selected group formats can be online',
      location: 'Czech Republic or online, depending on the format',
      price: 'Pricing on request',
      topicIds: ['wellness', 'bodywork', 'aromatherapy'],
      practitionerIds: ['katerina'],
      placeIds: ['santiago-studio-praha'],
      eventFormatIds: [],
      provider: 'Katerina',
      detailUrl: 'offer-katerina.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask on Telegram'
    },
    {
      id: 'lila-reading',
      slug: 'lila-reading',
      title: 'Lila and Therapeutic Path Reading',
      description: 'An individual Lila-based reflective session with Violetta Blago.',
      status: 'By request',
      duration: 'Not published',
      format: 'Individual',
      delivery: 'By arrangement',
      location: 'Europe / by arrangement',
      price: 'Pricing on request',
      topicIds: ['lila', 'mind-body', 'personal-development'],
      practitionerIds: ['violetta-blago'],
      placeIds: [],
      eventFormatIds: [],
      provider: 'Violetta Blago',
      detailUrl: 'profile-violetta.html',
      contactUrl: 'https://t.me/violettablago',
      contactLabel: 'Contact Violetta on Telegram'
    },
    {
      id: 'universal-therapy-constellations',
      slug: 'universal-therapy-constellations',
      title: 'Universal Therapy and Constellations',
      description: 'An individual therapeutic and constellation-based practice with Violetta Blago.',
      status: 'By request',
      duration: 'Not published',
      format: 'Individual',
      delivery: 'By arrangement',
      location: 'Europe / by arrangement',
      price: 'Pricing on request',
      topicIds: ['mind-body', 'personal-development'],
      practitionerIds: ['violetta-blago'],
      placeIds: [],
      eventFormatIds: [],
      provider: 'Violetta Blago',
      detailUrl: 'profile-violetta.html',
      contactUrl: 'https://t.me/violettablago',
      contactLabel: 'Contact Violetta on Telegram'
    },
    {
      id: 'purpose-brand-discovery',
      slug: 'purpose-brand-discovery',
      title: 'Personal Brand and Purpose Discovery',
      description: 'A guided discovery process for clarifying purpose, positioning and a personal brand direction.',
      status: 'By request',
      duration: 'Not published',
      format: 'Individual',
      delivery: 'By arrangement',
      location: 'Prague / by arrangement',
      price: 'Pricing on request',
      topicIds: ['personal-development', 'business'],
      practitionerIds: ['andrij-pycha'],
      placeIds: [],
      eventFormatIds: [],
      provider: 'Ethical Marketing & Automation Agency',
      detailUrl: 'ethical-automation-agency.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask on Telegram'
    },
    {
      id: 'interview-recording-production',
      slug: 'interview-recording-production',
      title: 'Interview and 4K Recording',
      description: 'Interview facilitation and 4K recording for people, projects and community stories.',
      status: 'By request',
      duration: 'Depends on the production scope',
      format: 'Individual or team',
      delivery: 'In person',
      location: 'Prague / by arrangement',
      price: 'Pricing on request',
      topicIds: ['media', 'community'],
      practitionerIds: ['andrij-pycha'],
      placeIds: ['santiago-studio-praha'],
      eventFormatIds: ['santiago-talks'],
      provider: 'Santiago Talks & Interviews',
      detailUrl: 'openmic.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask on Telegram'
    },
    {
      id: 'startup-marketing-automation',
      slug: 'startup-marketing-automation',
      title: 'Startup, Marketing, and Automation',
      description: 'Project support connecting startup direction, ethical marketing and practical automation.',
      status: 'By request',
      duration: 'Depends on the project scope',
      format: 'Individual or team',
      delivery: 'By arrangement',
      location: 'Prague / by arrangement',
      price: 'Pricing on request',
      topicIds: ['business', 'community'],
      practitionerIds: ['andrij-pycha'],
      placeIds: [],
      eventFormatIds: ['project-co-creation-circle'],
      provider: 'Ethical Marketing & Automation Agency',
      detailUrl: 'ethical-automation-agency.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask on Telegram'
    },
    {
      id: 'conscious-relationship-discovery',
      slug: 'conscious-relationship-discovery',
      title: 'Conscious Dating and Relationships',
      description: 'A developing group format for intentional connection, conscious dating and relationship discovery.',
      status: 'Coming soon',
      duration: 'Not published',
      format: 'Group',
      delivery: 'Hybrid concept',
      location: 'To be announced',
      price: 'Pricing on request',
      topicIds: ['relationships', 'personal-development', 'community'],
      practitionerIds: ['andrij-pycha'],
      placeIds: [],
      eventFormatIds: ['conscious-relationships'],
      provider: 'Conscious Relationships Platform',
      detailUrl: 'conscious-relationships.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask on Telegram'
    }
  ];

  var practitioners = [
    {
      id: 'ivan-protinak',
      slug: 'ivan-protinak',
      name: 'Ivan Protinyak',
      image: null,
      imageAlt: '',
      shortDescription: 'Bodywork practitioner focused on rehabilitation, massage and attentive physical practice.',
      approach: 'Combines rehabilitation knowledge with massage and an individual, body-aware approach.',
      fields: ['Rehabilitation', 'Massage', 'Bodywork'],
      topicIds: ['bodywork', 'rehabilitation'],
      location: 'Santiago Studio, Prague',
      city: 'Prague',
      country: 'Czech Republic',
      coordinates: null,
      locationPrecision: 'city',
      languages: ['Ukrainian (native)', 'Russian (fluent)', 'English (basic)'],
      onlineAvailability: 'Not published',
      experience: '5 years of experience; bachelor studies in Physical Therapy and Occupational Therapy.',
      serviceIds: ['deep-massage'],
      placeIds: ['santiago-studio-praha'],
      eventFormatIds: [],
      externalLinks: [],
      profileUrl: 'profile.html',
      contactUrl: 'suggest.html?topic=Deep%20Massage%20%26%20Tea%20Ceremony&details=I%20would%20like%20to%20contact%20Ivan%20Protinyak%20about%20his%20bodywork%20service%20at%20Santiago%20Studio%20in%20Prague.&city=Prague&preference=in_person#looking-for',
      contactLabel: 'Contact Ivan'
    },
    {
      id: 'katerina',
      slug: 'katerina',
      name: 'Katerina',
      image: null,
      imageAlt: '',
      shortDescription: 'Wellness practitioner working with body practices, aromatherapy and retreat formats.',
      approach: 'Creates individual and group wellness programmes with body practices and sensory care.',
      fields: ['Body practices', 'Aromatherapy', 'SPA retreats', 'Visual production'],
      topicIds: ['wellness', 'bodywork', 'aromatherapy', 'media'],
      location: 'Czech Republic',
      city: 'Prague',
      country: 'Czech Republic',
      coordinates: null,
      locationPrecision: 'city',
      languages: [],
      onlineAvailability: 'Selected Zoom group formats are described on the existing offer page.',
      experience: 'The existing profile states 4 years of professional experience in the Czech Republic.',
      serviceIds: ['wellness-programmes'],
      placeIds: ['santiago-studio-praha'],
      eventFormatIds: [],
      externalLinks: [],
      profileUrl: 'profile-katerina.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask on Telegram'
    },
    {
      id: 'violetta-blago',
      slug: 'violetta-blago',
      name: 'Violetta Blago',
      image: null,
      imageAlt: '',
      shortDescription: 'Facilitator of Lila, universal therapy, constellations, body therapy and women’s circles.',
      approach: 'Uses reflective and body-oriented practices to support personal inquiry.',
      fields: ['Lila', 'Universal therapy', 'Constellations', 'Body therapy', 'Women’s circles'],
      topicIds: ['lila', 'mind-body', 'personal-development', 'community'],
      location: 'Europe / Prague community',
      city: 'Prague',
      country: 'Czech Republic',
      coordinates: null,
      locationPrecision: 'city',
      languages: [],
      onlineAvailability: 'Not published',
      experience: 'The existing profile describes 5 years of exploring Lila.',
      serviceIds: ['lila-reading', 'universal-therapy-constellations'],
      placeIds: [],
      eventFormatIds: [],
      externalLinks: [
        { label: 'Telegram', url: 'https://t.me/violettablago' }
      ],
      profileUrl: 'profile-violetta.html',
      contactUrl: 'https://t.me/violettablago',
      contactLabel: 'Contact Violetta on Telegram'
    },
    {
      id: 'andrij-pycha',
      slug: 'andrij-pycha',
      name: 'Andrij Pycha',
      image: null,
      imageAlt: '',
      shortDescription: 'Community facilitator working across relationships, media, AI, marketing and project development.',
      approach: 'Connects personal discovery, community formats and practical project development.',
      fields: ['Facilitation', 'Relationships', 'Media', 'AI', 'Marketing', 'Project development'],
      topicIds: ['relationships', 'personal-development', 'media', 'business', 'community'],
      location: 'Prague · UA/CZ',
      city: 'Prague',
      country: 'Czech Republic',
      coordinates: null,
      locationPrecision: 'city',
      languages: ['Ukrainian', 'Czech', 'Russian', 'English', 'Polish'],
      onlineAvailability: 'Not published',
      experience: 'Experience is described through community, media, marketing and technology projects; no duration is published.',
      serviceIds: ['purpose-brand-discovery', 'interview-recording-production', 'startup-marketing-automation', 'conscious-relationship-discovery'],
      placeIds: [],
      eventFormatIds: ['conscious-relationships', 'santiago-talks', 'project-co-creation-circle'],
      externalLinks: [],
      profileUrl: 'profile-andrij.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask on Telegram'
    }
  ];

  var places = [
    {
      id: 'santiago-studio-praha',
      slug: 'santiago-studio-praha',
      name: 'Santiago Studio Praha',
      description: 'An active Prague studio used for body practices, women’s circles, community formats, filming and space rental.',
      type: 'Studio',
      status: 'Active',
      city: 'Prague',
      country: 'Czech Republic',
      address: null,
      mapUrl: null,
      coordinates: null,
      locationPrecision: 'city',
      topicIds: ['bodywork', 'wellness', 'media', 'community'],
      practitionerIds: ['ivan-protinak', 'katerina'],
      serviceIds: ['deep-massage', 'wellness-programmes', 'interview-recording-production'],
      eventFormatIds: ['santiago-talks'],
      detailUrl: 'space.html#place-santiago-studio-praha',
      contactUrl: 'suggest.html?topic=Santiago%20Studio%20Praha&details=I%20would%20like%20to%20ask%20about%20Santiago%20Studio%20and%20the%20services%20available%20there%20in%20Prague.&city=Prague&preference=in_person#looking-for',
      contactLabel: 'Ask about this place'
    }
  ];

  var eventFormats = [
    {
      id: 'conscious-relationships',
      slug: 'conscious-relationships',
      title: 'Conscious Relationships',
      description: 'A developing group format for intentional connection, conscious dating and relationship exploration.',
      kind: 'format',
      status: 'Concept · first group forming',
      format: 'Hybrid concept',
      location: 'To be announced',
      organizer: 'Conscious Relationships Platform',
      topicIds: ['relationships', 'personal-development', 'community'],
      practitionerIds: ['andrij-pycha'],
      placeIds: [],
      serviceIds: ['conscious-relationship-discovery'],
      detailUrl: 'conscious-relationships.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask about the format on Telegram'
    },
    {
      id: 'santiago-talks',
      slug: 'santiago-talks',
      title: 'Santiago Talks & Interviews',
      description: 'An interview and community-story format connected to Open Mic and 4K production.',
      kind: 'format',
      status: 'Available by request',
      format: 'In person',
      location: 'Prague / by arrangement',
      organizer: 'Open Mic',
      topicIds: ['media', 'community'],
      practitionerIds: ['andrij-pycha'],
      placeIds: ['santiago-studio-praha'],
      serviceIds: ['interview-recording-production'],
      detailUrl: 'openmic.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask about the format on Telegram'
    },
    {
      id: 'project-co-creation-circle',
      slug: 'project-co-creation-circle',
      title: 'Project Co-creation Circle',
      description: 'A developing format for people to discuss, shape and support early community projects.',
      kind: 'format',
      status: 'Format in development',
      format: 'Hybrid concept',
      location: 'To be announced',
      organizer: 'Santiago Incubator',
      topicIds: ['business', 'community'],
      practitionerIds: ['andrij-pycha'],
      placeIds: [],
      serviceIds: ['startup-marketing-automation'],
      detailUrl: 'projects.html',
      contactUrl: 'https://t.me/santioago_bot',
      contactLabel: 'Ask about the format on Telegram'
    }
  ];

  var data = {
    version: '1.0.0',
    topics: topics,
    services: services,
    practitioners: practitioners,
    places: places,
    eventFormats: eventFormats,
    scheduledEvents: []
  };

  data.getById = function (collection, id) {
    var records = data[collection];
    if (!Array.isArray(records)) return null;
    for (var index = 0; index < records.length; index += 1) {
      if (records[index].id === id) return records[index];
    }
    return null;
  };

  data.related = function (record, collection, field) {
    var ids = record && Array.isArray(record[field]) ? record[field] : [];
    return ids.map(function (id) {
      return data.getById(collection, id);
    }).filter(Boolean);
  };

  root.LumeyaData = data;

  if (root.document) {
    var event;
    if (typeof root.CustomEvent === 'function') {
      event = new root.CustomEvent('lumeya:data-ready', { detail: data });
    } else {
      event = root.document.createEvent('CustomEvent');
      event.initCustomEvent('lumeya:data-ready', false, false, data);
    }
    root.document.dispatchEvent(event);
  }
})(window);
