/**
 * Graveyard — 6 famous dead/changed pages for one-click demos.
 *
 * Each entry has a name, spooky description, the original URL, born/died years
 * for the tombstone display, and a `bestTs` "golden era" timestamp that the
 * frontend auto-selects when resolving snapshots.
 *
 * @typedef {Object} GraveEntry
 * @property {string} name - display name
 * @property {string} url - original URL to check
 * @property {string} description - short spooky description (epitaph)
 * @property {number} born - year the service launched
 * @property {number} died - year the service was shut down
 * @property {string} bestTs - 14-digit CDX timestamp to auto-select
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
    born: 1995,
    died: 2009,
    bestTs: '20090801000000',
  },
  {
    name: 'Google Wave',
    url: 'http://wave.google.com/',
    description: 'The future of email, once. It crashed on the shore in 2012; only the foam remains.',
    born: 2009,
    died: 2012,
    bestTs: '20090701000000',
  },
  {
    name: 'Yahoo Answers',
    url: 'https://answers.yahoo.com/',
    description: 'A chaotic oracle of dubious wisdom. Silenced in 2021, its questions echo forever.',
    born: 2005,
    died: 2021,
    bestTs: '20200601000000',
  },
  {
    name: 'Google+',
    url: 'https://plus.google.com/',
    description: 'The ghost of social networks past. Extinguished in 2019, leaving only empty circles.',
    born: 2011,
    died: 2019,
    bestTs: '20150601000000',
  },
  {
    name: 'AltaVista',
    url: 'http://www.altavista.com/',
    description: 'Once the king of search, now a spectral memory. Vanished from the web in 2013.',
    born: 1995,
    died: 2013,
    bestTs: '19990508000000',
  },
  {
    name: 'NCSA Mosaic',
    url: 'http://www.ncsa.uiuc.edu/SDG/Software/Mosaic/',
    description: 'The browser that woke the web. Its home page faded in 1997; we can still hear it boot.',
    born: 1993,
    died: 1997,
    bestTs: '19970101000000',
  },
];

/**
 * Get the graveyard entries.
 * @returns {GraveEntry[]}
 */
export function getGraveyard() {
  return GRAVEYARD;
}
