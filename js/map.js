
// ==========================================
// 1. Initialize MapLibre map
// ==========================================

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [10, 25],
  zoom: 1.5,
  minZoom: 1,
  maxZoom: 18
});

map.addControl(
  new maplibregl.NavigationControl(),
  'top-right'
);

let universities = {};
let selectedUniversityId = null;

const loading = document.getElementById('loading');


// ==========================================
// 2. Load publications JSON
// ==========================================

async function loadPublications() {

  try {

    const response = await fetch('data/publications.json');

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    // Validate JSON structure
    if (
      !Array.isArray(data.universities) ||
      !Array.isArray(data.publications)
    ) {
      throw new Error('Invalid publications JSON structure.');
    }

    processPublications(data);

  } catch (error) {

    console.error('Error loading publications:', error);

    loading.textContent =
      'Error loading publications. Please check the JSON file.';

  }

}


// ==========================================
// 3. Process publications and count
//    publications per university
// ==========================================

function processPublications(data) {

  universities = {};

  // Initialize universities
  data.universities.forEach(university => {

    if (!university.id) {
      console.warn('University without ID:', university);
      return;
    }

    if (universities[university.id]) {
      console.warn('Duplicate university ID:', university.id);
      return;
    }

    universities[university.id] = {
      ...university,
      publications: []
    };

  });


  // Associate publications with universities
  data.publications.forEach(publication => {

    if (!Array.isArray(publication.universities)) {
      return;
    }

    // Prevent duplicate counting within one publication
    const uniqueUniversityIds = new Set(
      publication.universities
    );

    uniqueUniversityIds.forEach(universityId => {

      const university = universities[universityId];

      if (university) {

        university.publications.push(publication);

      } else {

        console.warn(
          `Unknown university ID: ${universityId}`
        );

      }

    });

  });


  createMapMarkers();

}


// ==========================================
// 4. Convert universities to GeoJSON
// ==========================================

function createGeoJSON() {

  const features = Object.values(universities)

    .filter(university => {

      const lat = Number(university.lat);
      const lon = Number(university.lon);

      return (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      );

    })

    .map(university => ({

      type: 'Feature',

      geometry: {
        type: 'Point',
        coordinates: [
          Number(university.lon),
          Number(university.lat)
        ]
      },

      properties: {

        id: university.id,

        name: university.name,

        city: university.city,

        country: university.country,

        count: university.publications.length,

        publications: JSON.stringify(
          university.publications
        )

      }

    }));


  return {
    type: 'FeatureCollection',
    features: features
  };

}


// ==========================================
// 5. Create university markers
// ==========================================

function createMapMarkers() {

  const geojson = createGeoJSON();


  // Add GeoJSON source
  map.addSource('universities', {

    type: 'geojson',

    data: geojson

  });


  // Normal university circles
  map.addLayer({

    id: 'university-circles',

    type: 'circle',

    source: 'universities',

    paint: {

      // Circle radius proportional to publication count
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'count'],
        0, 5,
        1, 7,
        5, 12,
        10, 17,
        25, 23,
        50, 30,
        100, 38
      ],

      'circle-color': '#2878c8',

      'circle-opacity': 0.75,

      'circle-stroke-width': 1.5,

      'circle-stroke-color': '#ffffff'

    }

  });


  // Selected university highlight
  map.addLayer({

    id: 'university-selected',

    type: 'circle',

    source: 'universities',

    filter: [
      '==',
      ['get', 'id'],
      ''
    ],

    paint: {

      // Slightly larger than the original circle
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'count'],
        0, 9,
        1, 11,
        5, 16,
        10, 21,
        25, 27,
        50, 34,
        100, 42
      ],

      'circle-color': '#f28c28',

      'circle-opacity': 1,

      'circle-stroke-width': 3,

      'circle-stroke-color': '#ffffff'

    }

  });


  addMapInteractions();

  loading.style.display = 'none';

}


// ==========================================
// 6. Display university information
//    in the right-hand panel
// ==========================================

function showUniversityDetails(universityId) {

  const university = universities[universityId];

  if (!university) return;

  selectedUniversityId = universityId;


  // Highlight selected circle
  map.setFilter('university-selected', [
    '==',
    ['get', 'id'],
    universityId
  ]);


  // Show information panel
  document.getElementById('empty-state').style.display = 'none';

  document.getElementById('university-details').style.display = 'block';


  // University name
  document.getElementById('university-name').textContent =
    university.name;


  // City and country
  document.getElementById('university-location').textContent =
    [university.city, university.country]
      .filter(Boolean)
      .join(', ');


  // Publication count
  document.getElementById('publication-count').textContent =
    university.publications.length;


  // Publication list
  const publicationList =
    document.getElementById('publication-list');

  publicationList.replaceChildren();


  university.publications.forEach(publication => {

    const li = document.createElement('li');

    const title = document.createElement('div');

    const doi = String(publication.doi || '').trim();


    // Create DOI link if DOI is valid
    if (/^10\.\d{4,9}\/\S+$/i.test(doi)) {

      const link = document.createElement('a');

      const doiURL = 'https://doi.org/' +
        doi.split('/').map(encodeURIComponent).join('/');

      link.href = doiURL;

      link.target = '_blank';

      link.rel = 'noopener noreferrer';

      link.textContent =
        publication.title || 'Untitled publication';

      title.appendChild(link);

    } else {

      title.textContent =
        publication.title || 'Untitled publication';

    }


    // Publication year and journal

    // Authors
    const authors = document.createElement('span');

    authors.className = 'publication-authors';

    authors.textContent = Array.isArray(publication.authors)
    ? publication.authors.join(', ')
    : (publication.authors || 'Authors not specified');


    // Publication metadata
    const meta = document.createElement('span');

    meta.className = 'publication-meta';

    // Volume and issue
    let volumeIssue = '';

    if (publication.volume) {

    volumeIssue = publication.volume;

    if (publication.issue) {
        volumeIssue += `(${publication.issue})`;
    }

    } else if (publication.issue) {

    volumeIssue = `Issue ${publication.issue}`;

    }


    // Page numbers
    let pages = '';

    if (publication.pages) {

    pages = `pp. ${publication.pages}`;

    }


    // Publication metadata
    meta.textContent = [
    publication.year,
    publication.journal,
    volumeIssue,
    pages
    ].filter(Boolean).join(' · ');


    // Add elements to publication list
    li.appendChild(title);
    li.appendChild(authors);
    li.appendChild(meta);

    publicationList.appendChild(li);

  });

}


// ==========================================
// 7. Map interactions
// ==========================================

function addMapInteractions() {


  // ----------------------------------------
  // Hover tooltip
  // ----------------------------------------

  const hoverPopup = new maplibregl.Popup({

    closeButton: false,

    closeOnClick: false,

    offset: 12

  });


  map.on('mousemove', 'university-circles', event => {

    const feature = event.features[0];

    const universityName = feature.properties.name;

    map.getCanvas().style.cursor = 'pointer';


    hoverPopup

      .setLngLat(feature.geometry.coordinates)

      .setText(universityName)

      .addTo(map);

  });


  map.on('mouseleave', 'university-circles', () => {

    map.getCanvas().style.cursor = '';

    hoverPopup.remove();

  });


  // ----------------------------------------
  // Click on normal university circle
  // ----------------------------------------

  map.on('click', 'university-circles', event => {

    const feature = event.features[0];

    const universityId = feature.properties.id;

    showUniversityDetails(universityId);

  });


  // ----------------------------------------
  // Click on selected university circle
  // ----------------------------------------

  map.on('click', 'university-selected', event => {

    const feature = event.features[0];

    showUniversityDetails(feature.properties.id);

  });

}


// ==========================================
// 8. Start application
// ==========================================

map.on('load', loadPublications);


// ==========================================
// 9. Handle MapLibre errors
// ==========================================

map.on('error', event => {

  console.error('MapLibre error:', event.error);

});




// ==========================================
// 10. Publications list with filters
// ==========================================

function displayAllPublications(data) {

  const container = document.getElementById(
    'all-publications'
  );

  const totalElement = document.getElementById(
    'total-publications'
  );

  const countLabel = document.getElementById(
    'publication-count-label'
  );

  const searchInput = document.getElementById(
    'publication-search'
  );

  const yearFilter = document.getElementById(
    'filter-year'
  );

  const universityFilter = document.getElementById(
    'filter-university'
  );

  const journalFilter = document.getElementById(
    'filter-journal'
  );

  const resetButton = document.getElementById(
    'reset-publication-filters'
  );

  const resultsInfo = document.getElementById(
    'publication-results-info'
  );

  if (
    !container ||
    !totalElement ||
    !searchInput ||
    !yearFilter ||
    !universityFilter ||
    !journalFilter
  ) {
    console.warn('Publications section elements not found.');
    return;
  }

  // Build university lookup
  const universityLookup = {};

  (data.universities || []).forEach(university => {

    universityLookup[university.id] = university.name;

  });

  // Sort publications by year, newest first
  const publications = [...(data.publications || [])].sort(
    (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0)
  );

  // ========================================
  // 11. Populate filter options
  // ========================================

  function populateFilter(selectElement, values) {

    const sortedValues = [...new Set(
      values.filter(value =>
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ).map(String)
    )].sort((a, b) => a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base'
    }));

    sortedValues.forEach(value => {

      const option = document.createElement('option');

      option.value = value;
      option.textContent = value;

      selectElement.appendChild(option);

    });

  }

  // Years
  populateFilter(
    yearFilter,
    publications.map(publication => publication.year)
  );

  // Universities
  populateFilter(
    universityFilter,
    (data.universities || []).map(university => university.id)
  );

  // Replace university IDs with names in dropdown
  Array.from(universityFilter.options).forEach(option => {

    if (option.value) {
      option.textContent =
        universityLookup[option.value] || option.value;
    }

  });

  // Journals
  populateFilter(
    journalFilter,
    publications.map(publication => publication.journal)
  );


  // ========================================
  // 12. Render publications
  // ========================================

  function renderPublications() {

    container.replaceChildren();

    const searchTerm = searchInput.value
      .trim()
      .toLowerCase();

    const selectedYear = yearFilter.value;
    const selectedUniversity = universityFilter.value;
    const selectedJournal = journalFilter.value;


    // Apply all filters
    const filtered = publications.filter(publication => {

      // Year filter
      if (
        selectedYear &&
        String(publication.year) !== selectedYear
      ) {
        return false;
      }

      // University filter
      if (selectedUniversity) {

        const publicationUniversities =
          publication.universities || [];

        if (!publicationUniversities.includes(selectedUniversity)) {
          return false;
        }

      }

      // Journal filter
      if (
        selectedJournal &&
        String(publication.journal || '') !== selectedJournal
      ) {
        return false;
      }

      // Text search
      if (searchTerm) {

        const universityNames = (
          publication.universities || []
        ).map(id => universityLookup[id] || id);

        const authors = Array.isArray(publication.authors)
          ? publication.authors.join(' ')
          : (publication.authors || '');

        const searchableText = [

          publication.title,
          authors,
          publication.journal,
          publication.year,
          publication.volume,
          publication.issue,
          publication.pages,
          ...universityNames

        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchTerm)) {
          return false;
        }

      }

      return true;

    });


    // Update result count
    totalElement.textContent = filtered.length;

    if (countLabel) {
      countLabel.textContent =
        filtered.length === 1 ? 'Publication' : 'Publications';
    }

    if (resultsInfo) {

      resultsInfo.textContent =
        `Showing ${filtered.length} of ${publications.length} publications`;

    }


    // No results
    if (filtered.length === 0) {

      const message = document.createElement('p');

      message.className = 'no-publications';

      message.textContent =
        'No publications match the selected filters.';

      container.appendChild(message);

      return;

    }


    // Create publication entries
    filtered.forEach(publication => {

      const article = document.createElement('article');

      article.className = 'publication-item';


      // Publication title
      const title = document.createElement('h3');

      const doi = String(publication.doi || '').trim();

      if (/^10\.\d{4,9}\/\S+$/i.test(doi)) {

        const link = document.createElement('a');

        link.href = 'https://doi.org/' +
          doi.split('/').map(encodeURIComponent).join('/');

        link.target = '_blank';

        link.rel = 'noopener noreferrer';

        link.textContent =
          publication.title || 'Untitled publication';

        title.appendChild(link);

      } else {

        title.textContent =
          publication.title || 'Untitled publication';

      }

      article.appendChild(title);


      // Authors
      const authors = document.createElement('p');

      authors.className = 'publication-authors';

      authors.textContent = Array.isArray(publication.authors)
        ? publication.authors.join(', ')
        : (publication.authors || 'Authors not specified');

      article.appendChild(authors);


      // Journal metadata
      const metadata = document.createElement('p');

      metadata.className = 'publication-meta';

      let volumeIssue = '';

      if (publication.volume) {

        volumeIssue = publication.volume;

        if (publication.issue) {
          volumeIssue += `(${publication.issue})`;
        }

      } else if (publication.issue) {

        volumeIssue = `Issue ${publication.issue}`;

      }

      const pages = publication.pages
        ? `pp. ${String(publication.pages).replace(/--/g, '-')}`
        : '';

      metadata.textContent = [

        publication.year,
        publication.journal,
        volumeIssue,
        pages

      ].filter(Boolean).join(' · ');

      article.appendChild(metadata);


      // Collaborating universities
      const universityNames = (
        publication.universities || []
      )
        .map(id => universityLookup[id])
        .filter(Boolean);

      if (universityNames.length > 0) {

        const universityInfo = document.createElement('p');

        universityInfo.className = 'publication-universities';

        universityInfo.textContent =
          'Collaborating universities: ' +
          universityNames.join(', ');

        article.appendChild(universityInfo);

      }


      // DOI
      if (doi) {

        const doiInfo = document.createElement('p');

        doiInfo.className = 'publication-doi';

        doiInfo.textContent = 'DOI: ' + doi;

        article.appendChild(doiInfo);

      }

      container.appendChild(article);

    });

  }


  // ========================================
  // 13. Connect filters and search
  // ========================================

  searchInput.addEventListener(
    'input',
    renderPublications
  );

  yearFilter.addEventListener(
    'change',
    renderPublications
  );

  universityFilter.addEventListener(
    'change',
    renderPublications
  );

  journalFilter.addEventListener(
    'change',
    renderPublications
  );

  if (resetButton) {

    resetButton.addEventListener('click', () => {

      searchInput.value = '';

      yearFilter.value = '';

      universityFilter.value = '';

      journalFilter.value = '';

      renderPublications();

    });

  }

  // Initial display
  renderPublications();

}


// ==========================================
// 14. Load publications JSON
// ==========================================

async function loadAllPublications() {

  try {

    const response = await fetch('data/publications.json');

    if (!response.ok) {
      throw new Error('Could not load publications.json');
    }

    const data = await response.json();

    if (
      !Array.isArray(data.publications) ||
      !Array.isArray(data.universities)
    ) {
      throw new Error('Invalid publications JSON structure.');
    }

    displayAllPublications(data);

  } catch (error) {

    console.error('Error loading publications:', error);

    const container = document.getElementById(
      'all-publications'
    );

    if (container) {
      container.textContent =
        'Unable to load the publications list.';
    }

  }

}

loadAllPublications();

