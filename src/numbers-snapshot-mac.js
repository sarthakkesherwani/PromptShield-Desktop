/* macOS JavaScript for Automation. Read-only; no workbook writes or raw logging. */
function run() {
  try {
    var numbers;
    var identifiers = ['com.apple.Numbers', 'com.apple.iWork.Numbers'];
    for (var a = 0; a < identifiers.length; a++) {
      try { var candidate = Application(identifiers[a]); if (candidate.running()) { numbers = candidate; break; } } catch (_) {}
    }
    if (!numbers) return JSON.stringify({status:'waiting',reason:'Open Apple Numbers and a spreadsheet, then start monitoring.'});
    if (!numbers.documents.length) return JSON.stringify({status:'waiting',reason:'Open a spreadsheet in Apple Numbers.'});
    var doc = numbers.documents[0];
    var docId = doc.id();
    var sheet = doc.activeSheet;
    var sheetName = String(sheet.name());
    var tables = sheet.tables;
    var tableCount = tables.length;
    if (!tableCount) return JSON.stringify({status:'waiting',reason:'The active Numbers sheet has no tables to inspect.'});
    if (tableCount > 100) return JSON.stringify({status:'limited',reason:'Active Numbers sheet exceeds 100 tables.'});
    var dimensions = [], total = 0;
    for (var t = 0; t < tableCount; t++) {
      var rows = tables[t].rowCount(), columns = tables[t].columnCount();
      if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) return JSON.stringify({status:'limited',reason:'Numbers returned an unsupported table size.'});
      total += rows * columns;
      if (total > 20000) return JSON.stringify({status:'limited',reason:'Active Numbers sheet exceeds 20,000 table cells. Use a smaller sheet.'});
      dimensions.push({rows:rows,columns:columns});
    }
    var cells = [], chars = 0, selections = [];
    for (var i = 0; i < tableCount; i++) {
      var table = tables[i], size = dimensions[i], tableName = String(table.name());
      try { var selected = String(table.selectionRange.name()).replace(/\$/g,''); var single=/^([A-Z]+[1-9][0-9]*)(?::\1)?$/.exec(selected); if (single) selections.push({tableId:i,address:single[1]}); } catch (_) {}
      // Bulk reads use Numbers' own cell coordinates, not assumed enumeration order.
      var names = table.cells.name();
      var values = table.cells.formattedValue();
      if (!Array.isArray(names) || !Array.isArray(values) || names.length !== size.rows * size.columns || values.length !== names.length) return JSON.stringify({status:'limited',reason:'Numbers returned incomplete table values.'});
      var seen = {};
      for (var n = 0; n < names.length; n++) {
        var match = /^([A-Z]+)([1-9][0-9]*)$/.exec(String(names[n]));
        if (!match || seen[names[n]]) return JSON.stringify({status:'limited',reason:'Numbers returned unsupported cell coordinates.'});
        seen[names[n]] = true;
        var column = 0;
        for (var k = 0; k < match[1].length; k++) column = column * 26 + match[1].charCodeAt(k) - 64;
        var row = Number(match[2]);
        if (row > size.rows || column > size.columns) return JSON.stringify({status:'limited',reason:'Numbers table changed during inspection. Retry the scan.'});
        var value = values[n];
        if (value === null || value === undefined || value === '') continue;
        if (typeof value !== 'string') return JSON.stringify({status:'limited',reason:'Numbers returned an unsupported displayed value.'});
        chars += value.length;
        if (value.length > 32768 || chars > 1000000) return JSON.stringify({status:'limited',reason:'Numbers sheet exceeds the text scan limit.'});
        cells.push({table:tableName,tableId:i,row:row,column:column,text:value});
      }
      if (table.rowCount() !== size.rows || table.columnCount() !== size.columns) return JSON.stringify({status:'waiting',reason:'Numbers table changed. Monitoring will retry.'});
    }
    if (numbers.documents[0].id() !== docId || String(doc.activeSheet.name()) !== sheetName || sheet.tables.length !== tableCount) return JSON.stringify({status:'waiting',reason:'The active Numbers sheet changed. Monitoring will retry.'});
    return JSON.stringify({status:'snapshot',source:'numbers',documentId:docId,sheet:sheetName,selected:selections.length===1?selections[0]:null,cells:cells});
  } catch (error) {
    if (Number(error.errorNumber) === -1743) return JSON.stringify({status:'permission',reason:'Numbers access was denied. In System Settings → Privacy & Security → Automation, allow PromptShield Desktop to access Numbers, then press Start.'});
    return JSON.stringify({status:'waiting',reason:'Numbers is busy or unavailable. Finish editing the cell and retry.'});
  }
}
