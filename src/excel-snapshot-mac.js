/* Executed by macOS JavaScript for Automation, not the renderer. Read-only. */
function run() {
  try {
    var excel = Application('com.microsoft.Excel');
    if (!excel.running()) return JSON.stringify({status:'waiting',reason:'Open Microsoft Excel and a workbook, then start monitoring.'});
    if (!excel.workbooks.length) return JSON.stringify({status:'waiting',reason:'Open a workbook in desktop Microsoft Excel.'});
    var sheet = excel.activeSheet;
    var range = sheet.usedRange;
    var rows = range.rows.length;
    var columns = range.columns.length;
    if (!rows || !columns || rows * columns > 20000) return JSON.stringify({status:'limited',reason:'Active sheet exceeds the scan limit or is unavailable.'});
    var firstRow = range.rowIndex();
    var firstColumn = range.columnIndex();
    var values = range.value();
    if (rows === 1 && columns === 1 && !Array.isArray(values)) values = [[values]];
    if (!Array.isArray(values) || values.length !== rows) return JSON.stringify({status:'limited',reason:'Excel returned an unsupported range. No safety status is available.'});
    var cells = [], chars = 0;
    for (var r = 0; r < rows; r++) {
      if (!Array.isArray(values[r]) || values[r].length !== columns) return JSON.stringify({status:'limited',reason:'Excel returned incomplete cell values.'});
      for (var c = 0; c < columns; c++) {
        var value = values[r][c];
        if (value === null || value === undefined || value === '') continue;
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return JSON.stringify({status:'limited',reason:'This sheet contains an unsupported cell value.'});
        var text = String(value);
        chars += text.length;
        if (text.length > 32768 || chars > 1000000) return JSON.stringify({status:'limited',reason:'Sheet exceeds the text scan limit.'});
        cells.push({row:firstRow+r,column:firstColumn+c,text:text});
      }
    }
    return JSON.stringify({status:'snapshot',sheet:String(sheet.name()),cells:cells});
  } catch (error) {
    // Never include Excel error text: it can contain workbook information.
    if (Number(error.errorNumber) === -1743) return JSON.stringify({status:'permission',reason:'Excel access was denied. In System Settings → Privacy & Security → Automation, allow PromptShield Desktop to access Microsoft Excel, then press Start.'});
    return JSON.stringify({status:'waiting',reason:'Excel is busy or unavailable. Finish editing the cell and retry.'});
  }
}
