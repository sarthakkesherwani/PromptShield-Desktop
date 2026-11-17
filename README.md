# PromptShield Desktop

A local macOS and Windows Excel privacy companion with a frosted-glass interface, the PromptShield website’s crimson branding, light/dark appearance, and reviewable masked-value cards. The floating window checks the active worksheet every two seconds after you press **Start monitoring**. Green means no matches in inspected cell values, amber means sensitive data was detected, red means a blocking/critical credential was detected. Gray means paused, disconnected or unavailable. Uninspectable ranges never receive green status.

## Run on a Mac

Download the **Mac preview** from this repository's Releases page. Choose `arm64` for Apple Silicon (M1/M2/M3/M4 and newer) or `x64` for Intel. The DMG and ZIP contain the same app. Move the app to Applications, open Microsoft Excel with a workbook, launch PromptShield Desktop, then click **Start monitoring**.

macOS may ask to allow PromptShield Desktop to control Microsoft Excel. This permission enables read-only access to active worksheet values; application code does not modify the workbook. If denied, the panel explains how to review **System Settings → Privacy & Security → Automation**. Screen Recording, Accessibility and Full Disk Access are not required.

These preview downloads are unsigned and not notarized. Standard macOS security checks may block them; this project does not change those protections. Developer ID signing and notarization remain release prerequisites for a polished installation experience.

For developers: install Node.js 22+, then double-click `Start-PromptShield-Mac.command`, or run `bash Start-PromptShield-Mac.command` inside the extracted project folder. The launcher handles folder names with spaces and keeps the npm cache inside the project. Alternatively, run `npm ci --cache .npm-cache`, then `npm start`. `npm run dist:mac` builds Apple Silicon and Intel DMG/ZIP packages on macOS. Source runs may show the permission under the terminal or Electron rather than the packaged app name. Apple Numbers, Google Sheets and Excel web are not supported.

## Run on your Windows laptop

1. Install Node.js 22 or newer and Microsoft Excel desktop. Close any Excel instance running as administrator, then open Excel normally.
2. Download this repository using **Code → Download ZIP**, then extract it.
3. Double-click `Start-PromptShield.cmd`. First setup downloads npm dependencies and the Electron runtime. Internet is required for setup only.
4. Open your workbook in desktop Excel and click **Start monitoring** in the floating window.
5. Review cell references and masked previews. Copy a reviewed preview into the corresponding cell yourself. Pause or close the guard when finished.

For developers, `npm ci`, `npm run build`, `npm test`, then `npm start` perform the same setup. `npm run dist:win` builds a portable Windows executable. That build requires Windows or the build workflow. Release executables are unsigned until code signing is configured. Do not bypass a security warning to run an untrusted binary.

## Coverage and privacy

- Reads the active sheet's used cell values through Windows Excel COM or macOS Apple Events. It does not take screenshots or monitor other apps. Desktop Excel is required. Google Sheets, Excel web, Apple Numbers and LibreOffice live monitoring are not implemented.
- Looks for emails, credentials, OTPs, labelled Aadhaar, UPI, bank accounts and contextual personal data. Recognized first-row headers provide context for plain cell values. Every scan runs locally using bundled rules and the synthetic-trained context classifier.
- The companion opens no HTTP server and has no inference API key. Renderer requests are blocked except local files. Sandboxing, context isolation, a narrow IPC bridge and a restrictive content security policy are enabled.
- No workbook contents are written to disk, logged or sent to a cloud service by application code. Values exist temporarily in PowerShell or the macOS adapter and Node memory. Windows, Excel, clipboard history, crash dumps and other software may retain data independently.
- Checks up to 20,000 used cells and 1,000,000 text characters. Larger sheets report a review-needed status. Only the first 50 affected cells appear in the panel. Limits and disconnection never imply safety.
- Only values are inspected. Other worksheets, formula source, comments, shapes, images, embedded documents and external links require separate review. Changes update after a poll and may pause while Excel is editing a cell. Multiple Excel instances can cause COM to attach to a different active workbook.
- Masking suggestions require manual review. The companion does not prevent uploads or enforce policy in other applications. No detector guarantees complete detection or 10/10 security.

## Verification

The Mac adapter has 13 automated tests covering cell offsets, value types, denied permission, empty/unavailable Excel, scan limits, malformed ranges, process output, pause and timeouts. These use mocked Excel and process interfaces. The existing eight scanner regressions are retained. CI builds the actual detector bundle, runs all tests and packages apps on a macOS runner before publishing preview downloads.

Live Microsoft Excel integration has not been verified on macOS or Windows. GitHub-hosted runners do not include a signed-in desktop Excel session. Before calling this production-ready, validate both platforms with a clean sheet, synthetic credentials, an offset used range, cell editing, active sheet switching, permission denial, pause, Excel quit/reopen and a sheet over the scan limit. Confirm green only appears after a complete scan; compare masked previews against the source cells without using real secrets in testing.

## GitHub releases

This is a separate desktop repository. Pushes to main affecting Mac code trigger `.github/workflows/macos.yml`; tests and both architecture builds must succeed before a uniquely tagged Mac prerelease is published. The Windows workflow remains available for manual builds or `v*` tags. Mac previews have separate release tags so the existing Windows download remains available.
