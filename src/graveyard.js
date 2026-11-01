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
    name: 'Google Reader',
    url: 'http://www.google.com/reader/',
    description: 'The beloved RSS reader, laid to rest in 2013. Its ghost still feeds the faithful.',
    born: 2005,
    died: 2013,
    bestTs: '20120601000000',
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
    name: 'Orkut',
    url: 'http://www.orkut.com/',
    description: 'Google\'s first social experiment, haunting the web since 2014. Its communities are dust.',
    born: 2004,
    died: 2014,
    bestTs: '20130601000000',
  },
];

/**
 * Get the graveyard entries.
 * @returns {GraveEntry[]}
 */
export function getGraveyard() {
  return GRAVEYARD;
}
