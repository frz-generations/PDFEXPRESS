/*!
 * FRZ PDF Express — Windows printer driver access
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. MIT License. SPDX-License-Identifier: MIT
 *
 * Reads the printer driver's own paper sources, media types and quality modes (Windows "PrintCapabilities")
 * and prints with a Windows "PrintTicket" that carries those choices — the same mechanism Windows' own
 * printer-properties window uses. Runs Windows PowerShell with the .NET System.Printing classes.
 */
'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mapWindowsCapabilities } = require('./print-capabilities');
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

const PS_SCRIPT = String.raw`
param([string]$Mode,[string]$JobFile)
$ErrorActionPreference = 'Stop'
function Out-Json($o) { [Console]::Out.WriteLine('FRZJSON:' + ($o | ConvertTo-Json -Depth 8 -Compress)) }
try {
  Add-Type -AssemblyName System.Printing, PresentationCore, PresentationFramework, WindowsBase, ReachFramework, System.Drawing
  $j = Get-Content -Raw -Encoding UTF8 -LiteralPath $JobFile | ConvertFrom-Json

  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FrzWin {
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern int DocumentProperties(IntPtr hwnd, IntPtr hPrinter, string name, IntPtr pOut, IntPtr pIn, int mode);
  [DllImport("kernel32.dll")] public static extern IntPtr GlobalAlloc(uint f, UIntPtr n);
  [DllImport("kernel32.dll")] public static extern IntPtr GlobalLock(IntPtr h);
  [DllImport("kernel32.dll")] public static extern bool GlobalUnlock(IntPtr h);
  [DllImport("kernel32.dll")] public static extern UIntPtr GlobalSize(IntPtr h);
  [DllImport("kernel32.dll")] public static extern IntPtr GlobalFree(IntPtr h);
}
"@
  function New-Hdevmode($ps, $b64) {
    $h = $ps.GetHdevmode()
    if ($b64) {
      $bytes = [Convert]::FromBase64String($b64)
      if ($bytes.Length -le [int][FrzWin]::GlobalSize($h)) { $p = [FrzWin]::GlobalLock($h); [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $p, $bytes.Length); [void][FrzWin]::GlobalUnlock($h) }
    }
    return $h
  }
  # The printer driver's OWN Properties window (the same one Adobe and Word show).
  if ($Mode -eq 'props') {
    $ps = New-Object System.Drawing.Printing.PrinterSettings; $ps.PrinterName = [string]$j.printer
    if (-not $ps.IsValid) { throw 'Windows could not open that printer.' }
    $h = New-Hdevmode $ps ([string]$j.devmode)
    $hp = [IntPtr]::Zero
    if (-not [FrzWin]::OpenPrinter([string]$j.printer, [ref]$hp, [IntPtr]::Zero)) { [void][FrzWin]::GlobalFree($h); throw 'Windows could not open this printer driver.' }
    $p = [FrzWin]::GlobalLock($h)
    if ($p -eq [IntPtr]::Zero) { [void][FrzWin]::ClosePrinter($hp); [void][FrzWin]::GlobalFree($h); throw 'Windows could not allocate printer settings.' }
    try { $r = [FrzWin]::DocumentProperties([IntPtr][int64]$j.hwnd, $hp, [string]$j.printer, $p, $p, 14) }
    finally { [void][FrzWin]::GlobalUnlock($h); [void][FrzWin]::ClosePrinter($hp) }
    if ($r -eq -1) { [void][FrzWin]::GlobalFree($h); throw 'Windows could not read settings from this printer driver.' }
    if ($r -ne 1) { [void][FrzWin]::GlobalFree($h); Out-Json @{ ok = $true; cancelled = $true }; exit 0 }
    $sz = [int][FrzWin]::GlobalSize($h); $buf = New-Object byte[] $sz
    $p = [FrzWin]::GlobalLock($h); [System.Runtime.InteropServices.Marshal]::Copy($p, $buf, 0, $sz); [void][FrzWin]::GlobalUnlock($h)
    $want = [int][BitConverter]::ToUInt16($buf, 68) + [int][BitConverter]::ToUInt16($buf, 70)
    if ($want -gt 0 -and $want -lt $sz) { $buf = $buf[0..($want - 1)] }
    $ps.SetHdevmode($h); $pg = $ps.DefaultPageSettings
    $sum = @{ source = [string]$pg.PaperSource.SourceName; paper = [string]$pg.PaperSize.PaperName; color = [bool]$pg.Color; duplex = [string]$ps.Duplex; landscape = [bool]$pg.Landscape; copies = [int]$ps.Copies; res = ([string]$pg.PrinterResolution.X + 'x' + [string]$pg.PrinterResolution.Y) }
    [void][FrzWin]::GlobalFree($h)
    Out-Json @{ ok = $true; cancelled = $false; devmode = [Convert]::ToBase64String($buf); summary = $sum }
    exit 0
  }
  # Print page pictures using the settings saved from the driver's own window.
  if ($Mode -eq 'printdm') {
    $ps = New-Object System.Drawing.Printing.PrinterSettings; $ps.PrinterName = [string]$j.printer
    if (-not $ps.IsValid) { throw 'Windows could not open that printer.' }
    $h = [IntPtr]::Zero
    if ($j.devmode) { $h = New-Hdevmode $ps ([string]$j.devmode); $ps.SetHdevmode($h) }
    $ps.Copies = [int16]([Math]::Max(1, [int]$j.copies))
    $pd = New-Object System.Drawing.Printing.PrintDocument
    $pd.PrinterSettings = $ps; $pd.DocumentName = [string]$j.title
    if ($h -ne [IntPtr]::Zero) { $pd.DefaultPageSettings.SetHdevmode($h) }
    else {
      $kinds = @{ A4 = 'A4'; A3 = 'A3'; A5 = 'A5'; Letter = 'Letter'; Legal = 'Legal'; Tabloid = 'Tabloid' }
      if ($j.paper -and $kinds.ContainsKey([string]$j.paper)) { foreach ($sz in $ps.PaperSizes) { if ([string]$sz.Kind -eq $kinds[[string]$j.paper]) { $pd.DefaultPageSettings.PaperSize = $sz; break } } }
    }
    if ($j.sides -eq 'long') { $ps.Duplex = [System.Drawing.Printing.Duplex]::Vertical } elseif ($j.sides -eq 'short') { $ps.Duplex = [System.Drawing.Printing.Duplex]::Horizontal }
    if ($j.color -eq $false) { $pd.DefaultPageSettings.Color = $false }
    $pd.DefaultPageSettings.Landscape = ([double]$j.widthMm -gt [double]$j.heightMm)
    $pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $script:files = @($j.images); $script:i = 0
    $pd.add_PrintPage({
      param($s, $e)
      $img = [System.Drawing.Image]::FromFile([string]$script:files[$script:i])
      try {
        $b = $e.PageBounds; $hx = [double]$e.PageSettings.HardMarginX; $hy = [double]$e.PageSettings.HardMarginY
        $sc = [Math]::Min($b.Width / $img.Width, $b.Height / $img.Height); $dw = $img.Width * $sc; $dh = $img.Height * $sc
        $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $e.Graphics.DrawImage($img, [single](-$hx + ($b.Width - $dw) / 2), [single](-$hy + ($b.Height - $dh) / 2), [single]$dw, [single]$dh)
      } finally { $img.Dispose() }
      $script:i++
      $e.HasMorePages = ($script:i -lt $script:files.Count)
    })
    $pd.Print()
    if ($h -ne [IntPtr]::Zero) { [void][FrzWin]::GlobalFree($h) }
    Out-Json @{ ok = $true; message = 'Sent to ' + $ps.PrinterName + ' using the settings from the printer driver window.' }
    exit 0
  }
  $srv = New-Object System.Printing.LocalPrintServer
  $q = $null
  try { $q = $srv.GetPrintQueue([string]$j.printer) } catch { }
  if (-not $q) {
    $types = @([System.Printing.EnumeratedPrintQueueTypes]::Local, [System.Printing.EnumeratedPrintQueueTypes]::Connections)
    $q = $srv.GetPrintQueues($types) | Where-Object { $_.Name -eq $j.printer -or $_.FullName -eq $j.printer } | Select-Object -First 1
  }
  if (-not $q) { throw 'Windows could not open that printer.' }
  $PSF = 'http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework'
  $PSK = 'http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords'

  if ($Mode -eq 'caps') {
    $pc = $q.GetPrintCapabilities()
    $defaultName = ''
    try { $dt = $q.UserPrintTicket; if (-not $dt) { $dt = $q.DefaultPrintTicket }; if ($dt -and $dt.PageMediaSize -and $dt.PageMediaSize.PageMediaSizeName) { $defaultName = $dt.PageMediaSize.PageMediaSizeName.ToString() } } catch { }
    $ms = $q.GetPrintCapabilitiesAsXml(); $sr = New-Object System.IO.StreamReader($ms); $txt = $sr.ReadToEnd()
    $xml = New-Object System.Xml.XmlDocument; $xml.LoadXml($txt)
    $nsm = New-Object System.Xml.XmlNamespaceManager($xml.NameTable); $nsm.AddNamespace('psf', $PSF)
    $feats = @()
    foreach ($f in $xml.SelectNodes('/psf:PrintCapabilities/psf:Feature', $nsm)) {
      $fp = ''; if ($f.GetAttribute('name') -match '^([^:]+):') { $fp = $Matches[1] }
      $opts = @()
      foreach ($o in $f.SelectNodes('psf:Option', $nsm)) {
        $op = ''; if ($o.GetAttribute('name') -match '^([^:]+):') { $op = $Matches[1] }
        $d = $o.SelectSingleNode("psf:Property[@name='psk:DisplayName']/psf:Value", $nsm)
        $ww = 0; $hh = 0; $isDef = $false
        if ($f.GetAttribute('name') -eq 'psk:PageMediaSize') {
          $local = $o.GetAttribute('name') -replace '^[^:]+:', ''
          $sz = $pc.PageMediaSizeCapability | Where-Object { $_.PageMediaSizeName -and $_.PageMediaSizeName.ToString() -eq $local } | Select-Object -First 1
          if ($sz) { $ww = [Math]::Round(([double]$sz.Width * 25.4 / 96), 2); $hh = [Math]::Round(([double]$sz.Height * 25.4 / 96), 2) }
          $isDef = ($local -eq $defaultName)
        }
        $opts += [pscustomobject]@{ name = $o.GetAttribute('name'); uri = [string]$o.GetNamespaceOfPrefix($op); display = $(if ($d) { $d.InnerText } else { '' }); widthMm = $ww; heightMm = $hh; def = $isDef }
      }
      $feats += [pscustomobject]@{ name = $f.GetAttribute('name'); uri = [string]$f.GetNamespaceOfPrefix($fp); options = @($opts) }
    }
    Out-Json @{ ok = $true; features = @($feats) }
    exit 0
  }

  if ($Mode -eq 'print') {
    $base = $q.UserPrintTicket; if (-not $base) { $base = $q.DefaultPrintTicket }
    $pt0 = $base.Clone()
    $pt0.CopyCount = [int]$j.copies
    if ($j.sides -eq 'long') { $pt0.Duplexing = [System.Printing.Duplexing]::TwoSidedLongEdge }
    elseif ($j.sides -eq 'short') { $pt0.Duplexing = [System.Printing.Duplexing]::TwoSidedShortEdge }
    else { $pt0.Duplexing = [System.Printing.Duplexing]::OneSided }
    if ($j.color -eq $false) { $pt0.OutputColor = [System.Printing.OutputColor]::Monochrome } else { $pt0.OutputColor = [System.Printing.OutputColor]::Color }
    $sizes = @{ A4 = 'ISOA4'; A3 = 'ISOA3'; A5 = 'ISOA5'; Letter = 'NorthAmericaLetter'; Legal = 'NorthAmericaLegal'; Tabloid = 'NorthAmericaTabloid' }
    if ($j.paper -and $sizes.ContainsKey([string]$j.paper)) { $pt0.PageMediaSize = New-Object System.Printing.PageMediaSize([System.Printing.PageMediaSizeName]$sizes[[string]$j.paper]) }
    if ([double]$j.widthMm -gt [double]$j.heightMm) { $pt0.PageOrientation = [System.Printing.PageOrientation]::Landscape } else { $pt0.PageOrientation = [System.Printing.PageOrientation]::Portrait }
    # driver-specific choices (paper source, media type, quality) go in as a PrintTicket
    $x = New-Object System.Text.StringBuilder
    [void]$x.Append('<psf:PrintTicket version="1" xmlns:psf="' + $PSF + '" xmlns:psk="' + $PSK + '">')
    foreach ($c in @($j.features)) {
      $fe = [System.Security.SecurityElement]::Escape([string]$c.feature); $op = [System.Security.SecurityElement]::Escape([string]$c.option)
      $fx = ''; if (([string]$c.feature) -match '^([^:]+):' -and $Matches[1] -ne 'psk' -and $c.featureUri) { $fx = ' xmlns:' + $Matches[1] + '="' + [System.Security.SecurityElement]::Escape([string]$c.featureUri) + '"' }
      $ox = ''; if (([string]$c.option) -match '^([^:]+):' -and $Matches[1] -ne 'psk' -and $c.uri) { $ox = ' xmlns:' + $Matches[1] + '="' + [System.Security.SecurityElement]::Escape([string]$c.uri) + '"' }
      [void]$x.Append('<psf:Feature name="' + $fe + '"' + $fx + '><psf:Option name="' + $op + '"' + $ox + '/></psf:Feature>')
    }
    [void]$x.Append('</psf:PrintTicket>')
    $ms = New-Object System.IO.MemoryStream(,[System.Text.Encoding]::UTF8.GetBytes($x.ToString()))
    $delta = New-Object System.Printing.PrintTicket($ms)
    $res = $q.MergeAndValidatePrintTicket($pt0, $delta)
    $pt = $res.ValidatedPrintTicket

    $w = [double]$j.widthMm / 25.4 * 96; $h = [double]$j.heightMm / 25.4 * 96
    $fd = New-Object System.Windows.Documents.FixedDocument
    foreach ($f in @($j.images)) {
      $bmp = New-Object System.Windows.Media.Imaging.BitmapImage
      $bmp.BeginInit(); $bmp.UriSource = New-Object System.Uri([string]$f); $bmp.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad; $bmp.EndInit(); $bmp.Freeze()
      $img = New-Object System.Windows.Controls.Image; $img.Source = $bmp; $img.Width = $w; $img.Height = $h; $img.Stretch = [System.Windows.Media.Stretch]::Fill
      $page = New-Object System.Windows.Documents.FixedPage; $page.Width = $w; $page.Height = $h; [void]$page.Children.Add($img)
      $pc = New-Object System.Windows.Documents.PageContent; ([System.Windows.Markup.IAddChild]$pc).AddChild($page); [void]$fd.Pages.Add($pc)
    }
    $fd.DocumentPaginator.PageSize = New-Object System.Windows.Size($w, $h)
    $dlg = New-Object System.Windows.Controls.PrintDialog
    $dlg.PrintQueue = $q; $dlg.PrintTicket = $pt
    $dlg.PrintDocument($fd.DocumentPaginator, [string]$j.title)
    Out-Json @{ ok = $true; message = 'Sent to ' + $q.Name + ' with the paper source, media type and quality you chose.' }
    exit 0
  }
  throw 'Unknown mode.'
} catch {
  Out-Json @{ ok = $false; message = [string]$_.Exception.Message }
  exit 1
}
`;

function runPs(mode, job) {
  return new Promise(res => {
    let dir;
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frz-wp-'));
      const script = path.join(dir, 'p.ps1'), jf = path.join(dir, 'job.json');
      fs.writeFileSync(script, '﻿' + PS_SCRIPT, 'utf8'); fs.writeFileSync(jf, JSON.stringify(job), 'utf8');
      const done = r => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } res(r); };
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File', script, '-Mode', mode, '-JobFile', jf],
        { timeout: 120000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
          const line = String(stdout || '').split(/\r?\n/).reverse().find(l => l.startsWith('FRZJSON:'));
          if (line) { try { return done(JSON.parse(line.slice(8))); } catch (e) { } }
          done({ ok: false, message: String(stderr || (err && err.message) || 'Windows printing did not respond.').trim().slice(0, 300) });
        });
    } catch (e) { if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (x) { } } res({ ok: false, message: String(e.message || e) }); }
  });
}

/* What this printer's driver offers: paper sources, media types, quality modes. */
async function capabilities(printer) {
  const r = await runPs('caps', { printer });
  if (!r || !r.ok) return mapWindowsCapabilities([]);
  return mapWindowsCapabilities(r.features);
}

/* Open the printer driver's own Properties window; returns the saved settings (opaque) and a short summary. */
async function driverProperties(o) {
  if (!o || typeof o.printer !== 'string') return { ok: false, message: 'Bad request.' };
  const dm = typeof o.devmode === 'string' && /^[A-Za-z0-9+\/=]{0,200000}$/.test(o.devmode) ? o.devmode : '';
  const hwnd = typeof o.hwnd === 'string' && /^\d{1,20}$/.test(o.hwnd) ? o.hwnd : Number.isSafeInteger(o.hwnd) && o.hwnd >= 0 ? String(o.hwnd) : '0';
  return runPs('props', { printer: o.printer, devmode: dm, hwnd });
}

/* Print page pictures (JPEG, base64) with the chosen driver features. */
async function printImages(o) {
  if (!o || typeof o.printer !== 'string' || !Array.isArray(o.images) || !o.images.length) return { ok: false, message: 'Bad request.' };
  let dir;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frz-wi-'));
    const files = o.images.map((b64, i) => { const f = path.join(dir, 'p' + String(i).padStart(4, '0') + '.jpg'); fs.writeFileSync(f, Buffer.from(String(b64), 'base64')); return f; });
    const feats = arr(o.features).filter(c => c && typeof c.feature === 'string' && typeof c.option === 'string' && /^[\w.:\-]{1,120}$/.test(c.feature) && /^[\w.:\-]{1,120}$/.test(c.option));
    const dm = typeof o.devmode === 'string' && /^[A-Za-z0-9+\/=]{1,200000}$/.test(o.devmode) ? o.devmode : '';
    const r = await runPs(dm ? 'printdm' : 'print', {
      devmode: dm,
      printer: o.printer, copies: Math.min(99, Math.max(1, parseInt(o.copies, 10) || 1)), sides: ['long', 'short'].includes(o.sides) ? o.sides : 'one', color: o.color !== false,
      paper: String(o.paper || ''), widthMm: Number(o.widthMm) || 210, heightMm: Number(o.heightMm) || 297, title: String(o.title || 'FRZ PDF Express').slice(0, 80), features: feats, images: files,
    });
    return r;
  } catch (e) { return { ok: false, message: String(e.message || e) }; }
  finally { if (dir) setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (x) { } }, 60000); }
}
module.exports = { capabilities, printImages, driverProperties };
