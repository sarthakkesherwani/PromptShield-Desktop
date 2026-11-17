# PromptShield Desktop

A local Windows Excel privacy companion. The floating window checks the active worksheet every two seconds after you press **Start monitoring**. Green means no matches in inspected cell values, amber means sensitive data was detected, red means a blocking/critical credential was detected. Gray means paused, disconnected or unavailable. Uninspectable ranges never receive green status.

## Run on your Windows laptop

1. Install Node.js 22 or newer and Microsoft Excel desktop. Close any Excel instance running as administrator, then open Excel normally.
2. Download this repository using **Code → Download ZIP**, then extract it.
3. Double-click `Start-PromptShield.cmd`. First setup downloads npm dependencies and the Electron runtime. Internet is required for setup only.
4. Open your workbook in desktop Excel and click **Start monitoring** in the floating window.
5. Review cell references and masked previews. Copy a reviewed preview into the corresponding cell yourself. Pause or close the guard when finished.

For developers, `npm ci`, `npm run build`, `npm test`, then `npm start` perform the same setup. `npm run dist:win` builds a portable Windows executable. That build requires Windows or the build workflow. Release executables are unsigned until code signing is configured. Do not bypass a security warning to run an untrusted binary.

## Coverage and privacy

- Reads the active sheet's used cell values through Windows Excel COM. It does not take screenshots or monitor other apps. Desktop Excel is required. Google Sheets, Excel web, macOS and LibreOffice live monitoring are not implemented.
- Looks for emails, credentials, OTPs, labelled Aadhaar, UPI, bank accounts and contextual personal data. Recognized first-row headers provide context for plain cell values. Every scan runs locally using bundled rules and the synthetic-trained context classifier.
- The companion opens no HTTP server and has no inference API key. Renderer requests are blocked except local files. Sandboxing, context isolation, a narrow IPC bridge and a restrictive content security policy are enabled.
- No workbook contents are written to disk, logged or sent to a cloud service by application code. Values exist temporarily in PowerShell/Node memory. Windows, Excel, clipboard history, crash dumps and other software may retain data independently.
- Checks up to 20,000 used cells and 1,000,000 text characters. Larger sheets report a review-needed status. Only the first 50 affected cells appear in the panel. Limits and disconnection never imply safety.
- Only values are inspected. Other worksheets, formula source, comments, shapes, images, embedded documents and external links require separate review. Changes update after a poll and may pause while Excel is editing a cell. Multiple Excel instances can cause COM to attach to a different active workbook.
- Masking suggestions require manual review. The companion does not prevent uploads or enforce policy in other applications. No detector guarantees complete detection or 10/10 security.

## Verification

The detector build and eight desktop scan tests pass on Linux. A portable Windows x64 executable was built successfully on Linux, but has not been run on Windows. The website detector's 29 regression tests also pass. Windows COM attachment, Electron interaction with real Excel, require Windows testing before presenting this as a production release. This is an initial desktop implementation.

## GitHub releases

Keep this project in its own repository, for example `PromptShield-Desktop`. The workflow runs tests and builds on Windows. Push a tag such as `v0.1.0` to publish the portable executable under **Releases**, or run the workflow manually to download its build artifact. A GitHub-hosted Windows runner cannot test interaction with a real desktop Excel session.
