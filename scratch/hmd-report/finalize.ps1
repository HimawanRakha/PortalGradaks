param([string]$in,[string]$outDocx,[string]$outPdf)
$w = New-Object -ComObject Word.Application
$w.Visible = $false; $w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open($in, $false, $false)
  foreach ($sid in @(-20,-21)) { $st = $d.Styles.Item($sid); $st.ParagraphFormat.SpaceAfter = 1; $st.ParagraphFormat.SpaceBefore = 0; $st.ParagraphFormat.LineSpacingRule = 0 }
  $d.Styles.Item(-21).ParagraphFormat.LeftIndent = 12
  $d.Fields.Update() | Out-Null
  foreach ($t in $d.TablesOfContents) { $t.Update() }
  $d.Repaginate()
  foreach ($t in $d.TablesOfContents) { $t.UpdatePageNumbers() }
  $d.SaveAs2($outDocx, 16)
  $d.ExportAsFixedFormat($outPdf, 17)
  $d.Close(0)
} finally { $w.Quit() }
