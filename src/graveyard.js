/**
 * Graveyard — 6 famous dead/changed pages for one-click demos.
 *
 * Each entry has a name, spooky description, and the original URL.
 * All of these now redirect to a different host or return a changed page,
 * so the pulse check classifies them as "possessed" (body-snatched).
 *
 * @typedef {Object} GraveEntry
 * @property {string} name - display name
 * @property {string} url - original URL to check
 * @property {string} description - short spooky description
 */

/**
 * The 6 famous dead/changed pages.
 * @type {GraveEntry[]}
 */
const GRAVEYARD = [
  {
    name: 'GeoCities',
    url: 'http://www.geocities.com/',
    description: 'A sprawling necropolis of personal homepages. Closed in 2009, its spirits haunt the archive.',
  },
  {
    name: 'Google Reader',
    url: 'http://www.google.com/reader/',
    description: 'The beloved RSS reader, laid to rest in 2013. Its ghost still feeds the faithful.',
  },
  {
    name: 'Yahoo Answers',
    url: 'https://answers.yahoo.com/',
    description: 'A chaotic oracle of dubious wisdom. Silenced in 2021, its questions echo forever.',
  },
  {
    name: 'Google+',
    url: 'https://plus.google.com/',
    description: 'The ghost of social networks past. Extinguished in 2019, leaving only empty circles.',
  },
  {
    name: 'AltaVista',
    url: 'http://www.altavista.com/',
    description: 'Once the king of search, now a spectral memory. Vanished from the web in 2013.',
  },
  {
    name: 'Orkut',
    url: 'http://www.orkut.com/',
    description: 'Google\'s first social experiment, haunting the web since 2014. Its communities are dust.',
  },
];

/**
 * Get the graveyard entries.
 * @returns {GraveEntry[]}
 */
export function getGraveyard() {
  return GRAVEYARD;
}
