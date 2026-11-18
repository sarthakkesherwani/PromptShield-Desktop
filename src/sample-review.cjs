const {scanSnapshot} = require('./scan.cjs');

function reviewSample(masked = false) {
  const cells = [
    {row:1, column:1, text:'Contact'},
    {row:1, column:2, text:'Order'},
    {row:2, column:1, text:'demo@example.com'},
    {row:2, column:2, text:'12 notebooks'},
    {row:3, column:1, text:'demo@example.com'},
    {row:3, column:2, text:'8 folders'}
  ];
  const scan = () => scanSnapshot({status:'snapshot', sheet:'Sample orders', cells});
  const original = scan();
  if (masked) {
    for (const item of original.items) {
      if (item.canApply) cells[item.id].text = item.preview;
    }
  }
  const result = masked ? scan() : original;
  return {cells:cells.map(cell => cell.text), count:result.count, scanned:result.scanned};
}

module.exports = {reviewSample};
