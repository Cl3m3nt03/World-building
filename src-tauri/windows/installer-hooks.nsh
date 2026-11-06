; Installer hooks (bundle.windows.nsis.installerHooks), ADR 0016.
;
; Atlasaga was called BuilderZ up to 1.7.x. The NSIS keys and paths follow
; the product name, so a 1.7.x install lives under the old name: the HKCU
; uninstall key, the install-location key, %LOCALAPPDATA%\BuilderZ and the
; BuilderZ.lnk shortcuts. Without this hook the 1.8 installer would sit next
; to it and leave two apps. Once Atlasaga is installed, the old install is
; removed by hand (no old uninstaller is run).
;
; Never touched: the app data (%APPDATA%\app.builderz.desktop and
; %LOCALAPPDATA%\app.builderz.desktop, the bundle identifier did not change)
; and the worlds, wherever they are.

; /ifndef: a test build of the hook can point them at throwaway places.
!define /ifndef LEGACY_PRODUCTNAME "BuilderZ"
!define /ifndef LEGACY_MANUKEY "Software\${LEGACY_PRODUCTNAME}"
!define /ifndef LEGACY_MANUPRODUCTKEY "${LEGACY_MANUKEY}\${LEGACY_PRODUCTNAME}"
!define /ifndef LEGACY_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${LEGACY_PRODUCTNAME}"
!define /ifndef LEGACY_RUNKEY "Software\Microsoft\Windows\CurrentVersion\Run"
!define /ifndef LEGACY_DEFAULT_DIR "$LOCALAPPDATA\${LEGACY_PRODUCTNAME}"
!define /ifndef LEGACY_STARTMENU_DIR "$SMPROGRAMS"
!define /ifndef LEGACY_DESKTOP_DIR "$DESKTOP"

!macro NSIS_HOOK_POSTINSTALL
  Push $R7
  Push $R8
  Push $R9

  ; $R9: whether a BuilderZ install is registered for this user.
  StrCpy $R9 0
  ReadRegStr $R8 HKCU "${LEGACY_UNINSTKEY}" "UninstallString"
  ${If} $R8 != ""
    StrCpy $R9 1
  ${EndIf}
  ; $R7: its folder, from the key the 1.7.x installer wrote, else its default.
  ReadRegStr $R7 HKCU "${LEGACY_MANUPRODUCTKEY}" ""
  ${If} $R7 != ""
    StrCpy $R9 1
  ${Else}
    StrCpy $R7 "${LEGACY_DEFAULT_DIR}"
  ${EndIf}

  ${If} $R9 = 1
    DetailPrint "Removing the previous BuilderZ install from $R7"

    ; Its shortcuts, only when they point to its exe.
    !insertmacro IsShortcutTarget "${LEGACY_STARTMENU_DIR}\${LEGACY_PRODUCTNAME}.lnk" "$R7\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "${LEGACY_STARTMENU_DIR}\${LEGACY_PRODUCTNAME}.lnk"
      Delete "${LEGACY_STARTMENU_DIR}\${LEGACY_PRODUCTNAME}.lnk"
    ${EndIf}
    !insertmacro IsShortcutTarget "${LEGACY_DESKTOP_DIR}\${LEGACY_PRODUCTNAME}.lnk" "$R7\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "${LEGACY_DESKTOP_DIR}\${LEGACY_PRODUCTNAME}.lnk"
      Delete "${LEGACY_DESKTOP_DIR}\${LEGACY_PRODUCTNAME}.lnk"
      ; There was a desktop shortcut: keep one, under the new name.
      CreateShortcut "${LEGACY_DESKTOP_DIR}\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
      !insertmacro SetLnkAppUserModelId "${LEGACY_DESKTOP_DIR}\${PRODUCTNAME}.lnk"
    ${EndIf}

    ; Its two files, unless Atlasaga was installed in the same folder.
    ${If} $R7 != $INSTDIR
      Delete "$R7\${MAINBINARYNAME}.exe"
      Delete "$R7\uninstall.exe"
      RMDir "$R7"
    ${EndIf}

    ; Its registry entries: « Installed apps », install location, autostart.
    DeleteRegKey HKCU "${LEGACY_UNINSTKEY}"
    DeleteRegKey HKCU "${LEGACY_MANUPRODUCTKEY}"
    DeleteRegKey /ifempty HKCU "${LEGACY_MANUKEY}"
    DeleteRegValue HKCU "${LEGACY_RUNKEY}" "${LEGACY_PRODUCTNAME}"
  ${EndIf}

  Pop $R9
  Pop $R8
  Pop $R7
!macroend
