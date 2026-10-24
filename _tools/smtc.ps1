# Read Windows global media sessions (SMTC), print one JSON line every N ms
# Run with powershell.exe 5.1 (best WinRT support)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

$mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]

while ($true) {
  $out = $null
  try {
    $mgr = Await ($mgrType::RequestAsync()) $mgrType
    $sessions = $mgr.GetSessions()

    $best = $null
    $bestScore = -1
    foreach ($s in $sessions) {
      try {
        $pi = $s.GetPlaybackInfo()
        $status = $pi.PlaybackStatus.ToString()
        $appId = ([string]$s.SourceAppUserModelId).ToLower()
        $score = 0
        if ($status -eq 'Playing') { $score += 100 }
        if ($appId -match 'cloudmusic|qqmusic|spotify|kugou|kuwo|foobar|music|neteas') { $score += 60 }
        if ($appId -match 'chrome|msedge|firefox|browser') { $score -= 20 }
        if ($score -gt $bestScore) { $bestScore = $score; $best = $s }
      } catch {}
    }

    if ($null -ne $best) {
      $pi = $best.GetPlaybackInfo()
      $play = $pi.PlaybackStatus.ToString()
      $title = ''; $artist = ''
      try {
        $info = Await ($best.TryGetMediaPropertiesAsync()) $propsType
        $title = [string]$info.Title
        $artist = [string]$info.Artist
      } catch {}

      $pos = 0.0
      $dur = 0.0
      try {
        $tl = $best.GetTimelineProperties()
        $pos = [math]::Round($tl.Position.TotalSeconds, 1)
        $dur = [math]::Round($tl.EndTime.TotalSeconds, 1)
      } catch {}

      $out = [pscustomobject]@{
        playing  = ($play -eq 'Playing')
        title    = $title
        artist   = $artist
        app      = [string]$best.SourceAppUserModelId
        position = $pos
        duration = $dur
      }
    } else {
      $out = [pscustomobject]@{ playing = $false; title = ''; artist = ''; app = ''; position = 0; duration = 0 }
    }
  } catch {
    $out = [pscustomobject]@{ playing = $false; title = ''; artist = ''; app = ''; position = 0; duration = 0; err = '1' }
  }
  $out | ConvertTo-Json -Compress
  Start-Sleep -Milliseconds 1500
}
