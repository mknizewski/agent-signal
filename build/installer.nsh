!ifndef MUI_BGCOLOR
  !define MUI_BGCOLOR "121313"
!endif
!ifndef MUI_TEXTCOLOR
  !define MUI_TEXTCOLOR "F2F2EE"
!endif
!ifndef MUI_HEADER_BGCOLOR
  !define MUI_HEADER_BGCOLOR "181919"
!endif
!ifndef MUI_HEADER_TEXTCOLOR
  !define MUI_HEADER_TEXTCOLOR "F2F2EE"
!endif
!ifndef MUI_INSTFILESPAGE_COLORS
  !define MUI_INSTFILESPAGE_COLORS "F2F2EE 121313"
!endif
!ifndef MUI_FINISHPAGE_LINK_COLOR
  !define MUI_FINISHPAGE_LINK_COLOR "3DB47A"
!endif
!ifndef BUILD_UNINSTALLER
  !ifndef MUI_CUSTOMFUNCTION_GUIINIT
    !define MUI_CUSTOMFUNCTION_GUIINIT AgentSignalThemeGuiInit
  !endif
!endif

LangString AS_DIRECTORY_TITLE 1033 "Choose an installation folder"
LangString AS_DIRECTORY_TITLE 1045 "Wybierz folder instalacji"
LangString AS_DIRECTORY_SUBTITLE 1033 "Choose where Agent Signal should be installed."
LangString AS_DIRECTORY_SUBTITLE 1045 "Wybierz miejsce, w którym ma zostać zainstalowany Agent Signal."
LangString AS_DIRECTORY_LABEL 1033 "Destination folder"
LangString AS_DIRECTORY_LABEL 1045 "Folder docelowy"
LangString AS_DIRECTORY_BROWSE 1033 "Browse..."
LangString AS_DIRECTORY_BROWSE 1045 "Przeglądaj..."
LangString AS_DIRECTORY_HINT 1033 "Agent Signal will create its own subfolder in the selected location."
LangString AS_DIRECTORY_HINT 1045 "Agent Signal utworzy własny podfolder w wybranej lokalizacji."

!macro customHeader
  BrandingText "Agent Signal"
!macroend

!macro customWelcomePage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW AgentSignalApplyTheme
  !insertmacro MUI_PAGE_WELCOME
  ; The welcome page consumes the MUI show callback. Re-register it so the
  ; electron-builder install-mode page is themed after nsDialogs creates it.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW AgentSignalApplyTheme
!macroend

!macro customInit
  SetCtlColors $HWNDPARENT "F2F2EE" "121313"
!macroend

!ifndef BUILD_UNINSTALLER
Var AgentSignalDarkBrush
Var AgentSignalDirectoryDialog
Var AgentSignalDirectoryText
Var AgentSignalDirectoryBrowse

Function AgentSignalThemeGuiInit
  System::Call "gdi32::CreateSolidBrush(i 0x00131312) i.r0"
  StrCpy $AgentSignalDarkBrush $0
  System::Call "user32::SetClassLongW(i $HWNDPARENT, i -10, i $AgentSignalDarkBrush)"
  Call AgentSignalApplyTheme
FunctionEnd

Function AgentSignalApplyTheme
  SetCtlColors $HWNDPARENT "F2F2EE" "121313"

  FindWindow $0 "#32770" "" $HWNDPARENT
  System::Call "user32::SetClassLongW(i $0, i -10, i $AgentSignalDarkBrush)"
  SetCtlColors $0 "F2F2EE" "121313"

  ; Standard page body: labels, directory field and destination group.
  GetDlgItem $1 $0 1006
  SetCtlColors $1 "D9DAD7" "121313"
  GetDlgItem $1 $0 1019
  SetCtlColors $1 "F2F2EE" "1B1C1C"
  GetDlgItem $1 $0 1020
  SetCtlColors $1 "D9DAD7" "121313"
  GetDlgItem $1 $0 1023
  SetCtlColors $1 "B7B8B4" "121313"
  GetDlgItem $1 $0 1024
  SetCtlColors $1 "B7B8B4" "121313"

  ; Per-user/per-machine page created by electron-builder.
  GetDlgItem $1 $0 1200
  SetCtlColors $1 "D9DAD7" "121313"
  GetDlgItem $1 $0 1201
  System::Call "uxtheme::SetWindowTheme(i $1, w '', w '')"
  SetCtlColors $1 "F2F2EE" "121313"
  GetDlgItem $1 $0 1202
  System::Call "uxtheme::SetWindowTheme(i $1, w '', w '')"
  SetCtlColors $1 "F2F2EE" "121313"
  GetDlgItem $1 $0 1203
  SetCtlColors $1 "B7B8B4" "121313"

  ; Header, footer and branding around the active page.
  GetDlgItem $1 $HWNDPARENT 1028
  SetCtlColors $1 "8D8F8A" "121313"
  GetDlgItem $1 $HWNDPARENT 1034
  SetCtlColors $1 "343636" "121313"
  GetDlgItem $1 $HWNDPARENT 1037
  SetCtlColors $1 "F2F2EE" "181919"
  GetDlgItem $1 $HWNDPARENT 1038
  SetCtlColors $1 "B7B8B4" "181919"

  System::Call "user32::InvalidateRect(i $0, i 0, i 1)"
  System::Call "user32::InvalidateRect(i $HWNDPARENT, i 0, i 1)"
FunctionEnd
!endif

!macro customPageAfterChangeDir
  !include StrContains.nsh
  Page custom AgentSignalDirectoryPageCreate AgentSignalDirectoryPageLeave

  Function AgentSignalDirectoryPageCreate
    !insertmacro MUI_HEADER_TEXT "$(AS_DIRECTORY_TITLE)" "$(AS_DIRECTORY_SUBTITLE)"
    nsDialogs::Create 1018
    Pop $AgentSignalDirectoryDialog
    ${If} $AgentSignalDirectoryDialog == error
      Abort
    ${EndIf}

    SetCtlColors $AgentSignalDirectoryDialog "F2F2EE" "121313"

    ${NSD_CreateLabel} 0u 12u 300u 28u "$(AS_DIRECTORY_SUBTITLE)"
    Pop $0
    SetCtlColors $0 "D9DAD7" "121313"

    ${NSD_CreateLabel} 0u 55u 300u 12u "$(AS_DIRECTORY_LABEL)"
    Pop $0
    SetCtlColors $0 "B7B8B4" "121313"

    ${NSD_CreateText} 0u 72u 220u 15u "$INSTDIR"
    Pop $AgentSignalDirectoryText
    SetCtlColors $AgentSignalDirectoryText "F2F2EE" "1B1C1C"

    ${NSD_CreateButton} 230u 71u 70u 17u "$(AS_DIRECTORY_BROWSE)"
    Pop $AgentSignalDirectoryBrowse
    ${NSD_OnClick} $AgentSignalDirectoryBrowse AgentSignalDirectoryBrowse

    ${NSD_CreateLabel} 0u 110u 300u 34u "$(AS_DIRECTORY_HINT)"
    Pop $0
    SetCtlColors $0 "B7B8B4" "121313"

    nsDialogs::Show
  FunctionEnd

  Function AgentSignalDirectoryBrowse
    Pop $0
    nsDialogs::SelectFolderDialog "$(AS_DIRECTORY_TITLE)" "$INSTDIR"
    Pop $0
    ${If} $0 != error
      StrCpy $INSTDIR "$0\${APP_FILENAME}"
      ${NSD_SetText} $AgentSignalDirectoryText "$INSTDIR"
    ${EndIf}
  FunctionEnd

  Function AgentSignalDirectoryPageLeave
    ${NSD_GetText} $AgentSignalDirectoryText $INSTDIR
    ${If} $INSTDIR == ""
      Abort
    ${EndIf}
    ${StrContains} $0 "${APP_FILENAME}" $INSTDIR
    ${If} $0 == ""
      StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
    ${EndIf}
  FunctionEnd

  !define MUI_PAGE_CUSTOMFUNCTION_SHOW AgentSignalApplyTheme
!macroend
