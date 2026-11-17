$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Release-Com($obj) {
  if ($null -ne $obj -and [Runtime.InteropServices.Marshal]::IsComObject($obj)) {
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($obj)
  }
}
while ($true) {
  $excel = $null; $sheet = $null; $range = $null; $book = $null
  try {
    $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
    $book = $excel.ActiveWorkbook
    $sheet = $excel.ActiveSheet
    if ($null -eq $book -or $null -eq $sheet) { throw 'No workbook' }
    $range = $sheet.UsedRange
    $rows = [int]$range.Rows.Count; $cols = [int]$range.Columns.Count
    # Refuse large ranges before transferring their contents into memory.
    if ([long]$rows * $cols -gt 20000) {
      $message = @{status='limited'; reason='Active sheet exceeds 20,000 cells. Scan a smaller sheet in the website.'}
    } else {
      $values = $range.Value2
      $cells = [System.Collections.Generic.List[object]]::new()
      $chars = 0; $limited = $false
      for ($r=1; $r -le $rows; $r++) {
        for ($c=1; $c -le $cols; $c++) {
          if ($rows -eq 1 -and $cols -eq 1) { $value = $values } else { $value = $values[$r,$c] }
          if ($null -eq $value -or "$value" -eq '') { continue }
          $text = [string]$value
          $chars += $text.Length
          if ($text.Length -gt 32768 -or $chars -gt 1000000) { $limited = $true; break }
          $cells.Add(@{row=([int]$range.Row+$r-1); column=([int]$range.Column+$c-1); text=$text})
        }
        if ($limited) { break }
      }
      if ($limited) { $message = @{status='limited'; reason='Sheet exceeds the text scan limit.'} }
      else { $message = @{status='snapshot'; sheet=[string]$sheet.Name; cells=@($cells.ToArray())} }
    }
    [Console]::WriteLine(($message | ConvertTo-Json -Depth 5 -Compress))
    $values=$null; $cells=$null; $message=$null
  } catch {
    [Console]::WriteLine('{"status":"waiting","reason":"Open an Excel workbook. If editing a cell, finish editing to resume scanning."}')
  } finally {
    Release-Com $range; Release-Com $sheet; Release-Com $book; Release-Com $excel
  }
  Start-Sleep -Seconds 2
}
