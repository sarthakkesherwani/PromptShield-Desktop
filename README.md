# PromptShield Desktop

A local Excel and Apple Numbers privacy companion for macOS, with Excel support on Windows with a transparent, frameless floating window, a smooth logo reveal on launch, the PromptShield website’s crimson branding, light/dark appearance, and reviewable masked-value cards. The floating window checks the active worksheet every two seconds after you press **Start monitoring**. Green means no matches in inspected cell values, amber means sensitive data was detected, red means a blocking/critical credential was detected. Gray means paused, disconnected or unavailable. Uninspectable ranges never receive green status.

## Run on a Mac

Download the **Mac preview** from this repository's Releases page. Choose `arm64` for Apple Silicon (M1/M2/M3/M4 and newer) or `x64` for Intel. The DMG and ZIP contain the same app. Move the app to Applications, open a spreadsheet in Excel or Numbers, launch PromptShield Desktop, select **Microsoft Excel** or **Apple Numbers (Mac)** under **Connect to**, then click **Start monitoring**.

macOS may ask to allow PromptShield Desktop to control the spreadsheet app you selected (Excel or Numbers). This permission enables read-only access to active worksheet values; application code does not modify the workbook. If denied, the panel explains how to review **System Settings → Privacy & Security → Automation**. Screen Recording, Accessibility and Full Disk Access are not required.

These preview downloads are unsigned and not notarized. Standard macOS security checks may block them; this project does not change those protections. Developer ID signing and notarization remain release prerequisites for a polished installation experience.

For developers: install Node.js 22+, then double-click `Start-PromptShield-Mac.command`, or run `bash Start-PromptShield-Mac.command` inside the extracted project folder. The launcher handles folder names with spaces and keeps the npm cache inside the project. Alternatively, run `npm ci --cache .npm-cache`, then `npm start`. `npm run dist:mac` builds Apple Silicon and Intel DMG/ZIP packages on macOS. Source runs may show the permission under the terminal or Electron rather than the packaged app name. Google Sheets and Excel web are not supported.

## Run on your Windows laptop

1. Install Node.js 22 or newer and Microsoft Excel desktop. Close any Excel instance running as administrator, then open Excel normally.
2. Download this repository using **Code → Download ZIP**, then extract it.
3. Double-click `Start-PromptShield.cmd`. First setup downloads npm dependencies and the Electron runtime. Internet is required for setup only.
4. Open your workbook in desktop Excel and click **Start monitoring** in the floating window.
5. Review cell references and masked previews. Copy a reviewed preview into the corresponding cell yourself. Pause or close the guard when finished.

For developers, `npm ci`, `npm run build`, `npm test`, then `npm start` perform the same setup. `npm run dist:win` builds a portable Windows executable. That build requires Windows or the build workflow. Release executables are unsigned until code signing is configured. Do not bypass a security warning to run an untrusted binary.

## Coverage and privacy

- Reads the active sheet's used cell values through Windows Excel COM or macOS Apple Events for Excel and Numbers. It does not take screenshots or monitor other apps. Desktop Excel or Apple Numbers is required. Google Sheets, Excel web and LibreOffice live monitoring are not implemented.
- Looks for emails, credentials, OTPs, labelled Aadhaar, UPI, bank accounts and contextual personal data. Recognized first-row headers provide context for plain cell values. Every scan runs locally using bundled rules and the synthetic-trained context classifier.
- The companion opens no HTTP server and has no inference API key. Renderer requests are blocked except local files. Sandboxing, context isolation, a narrow IPC bridge and a restrictive content security policy are enabled.
- No workbook contents are written to disk, logged or sent to a cloud service by application code. Values exist temporarily in PowerShell or the macOS adapter and Node memory. Windows, Excel, clipboard history, crash dumps and other software may retain data independently.
- Checks up to 20,000 used cells and 1,000,000 text characters. Larger sheets report a review-needed status. Only the first 50 affected cells appear in the panel. Limits and disconnection never imply safety.
- Numbers checks displayed values across all tables in the active sheet, identifies locations as `Table name!B2`, and keeps each table’s header context separate. The combined limit is 20,000 cells across up to 100 tables. Switching the connection pauses monitoring and clears previews. Only values are inspected. Other worksheets, formula source, comments, shapes, images, embedded documents and external links require separate review. Changes update after a poll and may pause while Excel is editing a cell. Multiple Excel instances can cause COM to attach to a different active workbook.
- Masking suggestions require manual review. The companion does not prevent uploads or enforce policy in other applications. No detector guarantees complete detection or 10/10 security.

## Verification

The Excel Mac adapter has 13 automated tests covering cell offsets, value types, denied permission, empty/unavailable Excel, scan limits, malformed ranges, process output, pause and timeouts. These use mocked Excel and process interfaces. The existing eight scanner regressions are retained. Fourteen further tests cover Numbers snapshots and source selection, a scanner regression verifies Numbers table-specific header context, and eight tests cover cell review targets, changed values, navigation and hint positioning, and three Numbers selection tests, for 47 automated tests in total. CI builds the actual detector bundle, runs all tests and packages apps on a macOS runner before publishing preview downloads.

Live Microsoft Excel integration has not been verified on macOS or Windows. A packaged native Mac build was connected to the synthetic Numbers test workbook: a clean sheet produced zero findings and a credentials sheet produced three masked findings. The new cell-location popup still requires manual validation with Accessibility allowed. GitHub-hosted runners do not include a signed-in desktop Excel session. Before calling this production-ready, validate both platforms with a clean sheet, synthetic credentials, an offset used range, cell editing, active sheet switching, permission denial, pause, Excel quit/reopen and a sheet over the scan limit. Confirm green only appears after a complete scan; compare masked previews against the source cells without using real secrets in testing.

## GitHub releases

This is a separate desktop repository. Pushes to main affecting Mac code trigger `.github/workflows/macos.yml`; tests and both architecture builds must succeed before a uniquely tagged Mac prerelease is published. The Windows workflow remains available for manual builds or `v*` tags. Mac previews have separate release tags so the existing Windows download remains available.

## Floating window appearance

The native window uses a transparent background, no system title bar, and always-on-top behavior. Drag the logo/header area to move it; close it with the × button. macOS adds native under-window vibrancy. Glass surfaces remain lightly tinted so labels stay readable. The frame is fixed in size for reliable transparent-window behavior, fits within the primary display’s available work area, and scrolls for additional results. Reduced Motion skips the startup animation; Reduced Transparency uses a solid fallback. No screen capture permission is needed for the effect.

## Find the cell and review the suggestion

Select **Apple Numbers (Mac)** and start monitoring. Each finding shows its table and cell, a proposed replacement, **Show cell**, and **Copy value**. With **Suggestions beside selected cells** enabled, selecting a flagged cell in Numbers automatically displays an inline suggestion when Accessibility access and a reliable cell rectangle are available. For email cells the popup shows the original email followed by the replacement token, such as `demo@example.com → EMAIL_1`, plus the copyable `[EMAIL_1]` replacement. Original email text exists only in the local cell popup and is not saved or sent to a service. Other critical secrets use a generic original-value label. Show cell selects the exact cell in the same Numbers document and table without editing its contents. The explicit Show cell action pauses scanning for review. Automatic selection hints keep scanning. The cell value is rechecked against a digest before a suggestion is shown. If the cell, active sheet or document changed, run a fresh scan.

A popup beside the selected cell additionally needs macOS **Accessibility** access for PromptShield Desktop. Click **Open Accessibility settings** only if you want this feature, then allow the app yourself under **Privacy & Security → Accessibility**. Automatic hints do not activate Numbers or move the selection. The native helper reads selected-cell bounds in the frontmost Numbers app; it does not take screenshots, type or inspect other apps. Without permission or a reliable cell rectangle, the actual cell is still selected and the replacement remains in the panel. The hint tracks the selected cell for up to 15 seconds, hides when it cannot confirm the target, and closes when the cell changes. Copy the reviewed replacement and paste it yourself. Excel keeps its existing scanning and copy-preview workflow; on-cell navigation is currently Numbers-only.

On macOS, source builds compile a small universal Swift helper using Xcode Command Line Tools. Run `xcode-select --install` if your Mac reports that developer tools are missing, then rerun `npm start`. Packaged builds already include the helper.
