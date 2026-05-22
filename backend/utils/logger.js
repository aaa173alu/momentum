const util = require('util');

function formatArgs(args) {
  return args.map((a) => (typeof a === 'object' ? util.inspect(a, { depth: 5 }) : String(a))).join(' ');
}

module.exports = {
  info: (...args) => console.log('[info]', formatArgs(args)),
  warn: (...args) => console.warn('[warn]', formatArgs(args)),
  error: (...args) => console.error('[error]', formatArgs(args)),
};
