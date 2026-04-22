import { parseCSV } from './utils.js';

async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${path}`);
  }
  return await res.text();
}

async function fetchCSV(path) {
  const text = await fetchText(path);
  return parseCSV(text);
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${path}`);
  }
  return await res.json();
}

export async function loadAllData() {
  const universities = await fetchJSON('./data/manifests/universities.json');
  const enabledUniversities = (universities || []).filter((item) => item.enabled);

  const [
    cityScaleRows,
    climateRows,
    countryRows,
    languageRows,
    regionRows,
    residencyRows,
    rankingRows,
    displayNameRows,
    facultyGroupRows
  ] = await Promise.all([
    fetchCSV('./data/mappings/city_scale.csv'),
    fetchCSV('./data/mappings/climate.csv'),
    fetchCSV('./data/mappings/country.csv'),
    fetchCSV('./data/mappings/language.csv'),
    fetchCSV('./data/mappings/region.csv'),
    fetchCSV('./data/mappings/residency.csv'),
    fetchCSV('./data/mappings/rankings.csv'),
    fetchCSV('./data/mappings/display_name.csv'),
    fetchCSV('./data/mappings/faculty.csv')
  ]);

  const schoolBundles = await Promise.all(
    enabledUniversities.map(async (school, index) => {
      const slug = school.slug;

      const [programRows, campusCityRows] = await Promise.all([
        fetchCSV(`./data/programs/${slug}.csv`),
        fetchCSV(`./data/city_mappings/${slug}_campus_city.csv`)
      ]);

      return {
        school,
        manifest_order: index + 1,
        programRows,
        campusCityRows
      };
    })
  );

  return {
    universities: enabledUniversities,
    schoolBundles,
    mappings: {
      cityScaleRows,
      climateRows,
      countryRows,
      languageRows,
      regionRows,
      residencyRows,
      rankingRows,
      displayNameRows,
      facultyGroupRows
    }
  };
}