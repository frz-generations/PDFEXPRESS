# Printing implementation sources

This note records the primary references used to harden the existing desktop print workflow. Printer capabilities are device/driver-specific; the app should expose only options it can discover, and must retain the operating system's print-dialog fallback when discovery is unavailable.

- Electron's `webContents.getPrintersAsync()` enumerates installed printers. `webContents.print()` supports system-dialog printing and common properties such as copies, duplex, color, page size, and printer name, but it does not provide a portable API to enumerate each driver's tray/media/quality options. The app therefore continues to use the system dialog as a fallback rather than claiming that Electron's generic printer list contains all driver capabilities. [1]
- On Windows, `.NET System.Printing.PrintCapabilities` exposes the media sizes, input bins, media types, and output qualities a particular queue reports; `PrintTicket` carries settings including page media size and input bin. The existing Windows path is extended to use those driver-reported capabilities and submit matching ticket choices. Driver-specific behavior remains dependent on the installed driver and is not guaranteed for every printer. [2] [3]
- Windows `PageMediaSize.Width` and `Height` are in pixels where each pixel is 1/96 inch. The capability helper converts those values to millimetres for the preview and imposed page dimensions. [6]
- CUPS documents `lpoptions -p <printer> -l` as the way to list printer-specific options. Its print options support per-job settings, while actual sizes, sources, and media types depend on the printer. The Linux path therefore parses that queue's advertised choices and passes only discovered, syntactically safe values; if capability discovery is unavailable, users can use the native print dialog. [4] [5]

## References

[1]: https://www.electronjs.org/docs/latest/api/web-contents "Electron WebContents API"
[2]: https://learn.microsoft.com/en-us/dotnet/api/system.printing.printcapabilities.pagemediasizecapability?view=windowsdesktop-10.0 "Microsoft PrintCapabilities PageMediaSizeCapability"
[3]: https://learn.microsoft.com/en-us/dotnet/api/system.printing.printticket?view=windowsdesktop-10.0 "Microsoft System.Printing PrintTicket"
[4]: https://www.cups.org/doc/man-lpoptions.html "CUPS lpoptions Command"
[5]: https://www.cups.org/doc/options.html "CUPS Printing Options"
[6]: https://learn.microsoft.com/en-us/dotnet/api/system.printing.pagemediasize.width?view=windowsdesktop-10.0 "Microsoft PageMediaSize Width Property"
