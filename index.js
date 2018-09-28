const R = require('ramda');
const alfy = require('alfy');
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');

const TPB_URL = 'https://thepiratebay.org';
const NO_MATCHES = [
  {
    title: 'No matching torrents',
    subtitle: 'Try a different query',
    icon: { path: alfy.icon.warning },
    valid: false,
  },
];

function parseDate(rawDate) {
  const TIME_REGEX = /(?:\s(\d{2}):(\d{2}))?(?:\s(\d{4}))?/;
  const [ monthAndDay, timeAndYear ] = R.splitAt(rawDate.search(/\s+/), rawDate);
  const [ hour, minute, year ] = TIME_REGEX.exec(timeAndYear).slice(1);

  switch (monthAndDay) {
    case "Today": return moment({ hour, minute })
    case "Y-day": return moment({ hour, minute }).subtract({ day: 1 })
    default:
      const [ month, day ] = R.map(parseInt, /(\d{2})-(\d{2})/.exec(monthAndDay).slice(1));
      return moment({ year, month: month - 1, day, hour, minute })
  }
}

function parseDescription([, rawDate, , rawSize]) {
  return { date: parseDate(rawDate.slice(0, -1)), size: rawSize.slice(0, -1) };
}

function nodeToEntry($node) {
  const description = $node.find('.detDesc').text();
  const { date, size } = parseDescription(description.split(' '));

  const parseNodesToInts = R.map(R.pipe(R.of, cheerio.text, parseInt));
  const [seeders, leechers] = parseNodesToInts($node.children().splice(-2));

  return {
    title: $node.find('.detName').text().trim(),
    arg: $node.find('a[href^=magnet]').attr('href'),
    subtitle: [
      `Uploaded ${date.fromNow()} (${size}),`,
      `SE: ${seeders}⬆ |`,
      `LE: ${leechers}⬇`,
    ].join(' '),
    icon: { path: './magnet.png' },
    mods: {
      cmd: {
        arg: TPB_URL + $node.find('.detLink').attr('href'),
        subtitle: 'Reveal torrent in Browser',
      },
    },
  };
}

async function fetchTorrents(term) {
  const request = axios
    .get(`${TPB_URL}/search/` + encodeURIComponent(term))
    .then(r => cheerio.load(r.data))
    .then($ => R.map(
      R.pipe($, nodeToEntry),
      $('#searchResult tbody tr').toArray(),
    ));
  return await request;
}

(async () => {
  const torrents = await fetchTorrents(alfy.input);
  alfy.output(torrents.length > 0 ? torrents : NO_MATCHES);
})();
