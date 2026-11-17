set -e
S="$(pwd)"; R="C:/Users/HimawanRakha/Downloads/PROJECT/PortalGradaks/portalgradaks/laporan-hmd"; W=$(cygpath -w "$S")
DATE="16 November 2026"
for D in "$@"; do
  python -X utf8 work/ana.py . $D mentor/mentor.xlsx in/ipf.xlsx
  NAME=$(python -X utf8 -c "import json;print(json.load(open('work/stats_$D.json',encoding='utf8'))['deptName'].replace(' ','_'))")
  python -X utf8 work/charts.py . $D
  python -X utf8 work/build_xlsx.py . $D "$R/Data_Mentah_Maba_${NAME}_2026.xlsx" "$DATE"
  python -X utf8 work/build_mentor.py . $D "$R/Rekap_Mentor_${NAME}.xlsx"
  python -X utf8 work/build_docx.py . $D tpl/template.docx work/draft_$D.docx "$R/Data_Mentah_Maba_${NAME}_2026.xlsx" "$DATE" x
  powershell -NoProfile -ExecutionPolicy Bypass -File finalize.ps1 -in "$W\work\draft_$D.docx" -outDocx "$(cygpath -w "$R")\Laporan_Pengembangan_Maba_${NAME}_2026.docx" -outPdf "$W\work\final_$D.pdf"
  rm -f work/final_$D-p*.png work/final_$D-sheet*.png; python -X utf8 render.py work/final_$D.pdf 60; python sheet.py work/final_$D 6
done
