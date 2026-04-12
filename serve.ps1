# Static preview: http://localhost:8842/
# Run:  .\serve.ps1          — server only
#       .\serve.ps1 -Open    — also open your default browser (recommended; Cursor Simple Browser often cannot reach localhost)
param(
  [switch] $Open
)

$ErrorActionPreference = "Stop"
$port = 8842
$root = $PSScriptRoot
$rootFull = [IO.Path]::GetFullPath($root)

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".webp" = "image/webp"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Serving $rootFull" -ForegroundColor Green
Write-Host "  http://localhost:$port/" -ForegroundColor Cyan
Write-Host "(Ctrl+C to stop)" -ForegroundColor DarkGray

if ($Open) {
  Start-Sleep -Milliseconds 400
  Start-Process "http://localhost:$port/"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $urlPath = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
      if ($urlPath -eq "/" -or $urlPath -eq "") { $urlPath = "/index.html" }
      $rel = $urlPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
      $local = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))

      # Single-threaded listener: avoid keep-alive so parallel asset requests do not stall.
      $res.KeepAlive = $false
      $res.Headers.Add("Cache-Control", "no-store")

      if (-not $local.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
        $res.StatusCode = 403
        continue
      }

      if (-not (Test-Path -LiteralPath $local -PathType Leaf)) {
        $res.StatusCode = 404
        $enc = [Text.Encoding]::UTF8.GetBytes("Not found")
        $res.ContentLength64 = $enc.LongLength
        $res.OutputStream.Write($enc, 0, $enc.Length)
        continue
      }

      $ext = [IO.Path]::GetExtension($local).ToLowerInvariant()
      $bytes = [IO.File]::ReadAllBytes($local)
      $res.ContentType = $mime[$ext]
      if (-not $res.ContentType) { $res.ContentType = "application/octet-stream" }
      # Handle mislabeled exports: SVG payload saved with a .png extension.
      if ($ext -eq ".png" -and $bytes.Length -ge 4) {
        if ($bytes[0] -eq 0x3C -and $bytes[1] -eq 0x73 -and $bytes[2] -eq 0x76 -and $bytes[3] -eq 0x67) {
          $res.ContentType = "image/svg+xml; charset=utf-8"
        }
      }
      $res.ContentLength64 = $bytes.LongLength
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch [System.Net.HttpListenerException] {
      # Browser/client disconnected while response was streaming; keep server alive.
    } catch [System.IO.IOException] {
      # Treat transient socket write failures as non-fatal for this request.
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
