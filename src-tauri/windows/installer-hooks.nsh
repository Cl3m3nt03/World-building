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

!define LEGACY_PRODUCTNAME "BuilderZ"
!define LEGACY_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${LEGACY_PRODUCTNAME}"
!define LEGACY_MANUPRODUCTKEY "Software\${LEGACY_PRODUCTNAME}\${LEGACY_PRODUCTNAME}"

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
    StrCpy $R7 "$LOCALAPPDATA\${LEGACY_PRODUCTNAME}"
  ${EndIf}

  ${If} $R9 = 1
    DetailPrint "Removing the previous BuilderZ install from $R7"

    ; Its shortcuts, only when they point to its exe.
    !insertmacro IsShortcutTarget "$SMPROGRAMS\${LEGACY_PRODUCTNAME}.lnk" "$R7\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$SMPROGRAMS\${LEGACY_PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\${LEGACY_PRODUCTNAME}.lnk"
    ${EndIf}
    !insertmacro IsShortcutTarget "$DESKTOP\${LEGACY_PRODUCTNAME}.lnk" "$R7\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$DESKTOP\${LEGACY_PRODUCTNAME}.lnk"
      Delete "$DESKTOP\${LEGACY_PRODUCTNAME}.lnk"
      ; There was a desktop shortcut: keep one, under the new name.
      CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
      !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}

    ; Its two files, unless Atlasaga was installed in the same folder.
    ${If} $R7 != $INSTDIR
      Delete "$R7\${MAINBINARYNAME}.exe"
      Delete "$R7\uninstall.exe"
      RMDir "$R7"
    ${EndIf}

    ; Its registry entries: « Apps & features », install location, autostart.
    DeleteRegKey HKCU "${LEGACY_UNINSTKEY}"
    DeleteRegKey HKCU "${LEGACY_MANUPRODUCTKEY}"
    DeleteRegKey /ifempty HKCU "Software\${LEGACY_PRODUCTNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${LEGACY_PRODUCTNAME}"
  ${EndIf}

  Pop $R9
  Pop $R8
  Pop $R7
!macroend
