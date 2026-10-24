# 常驻：每隔 N 毫秒输出一行 JSON —— 所有可见顶层窗口的矩形
param([int]$IntervalMs = 250)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinRect {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int n);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint cmd);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int idx);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$sb = New-Object System.Text.StringBuilder 512
while ($true) {
  $fgId = [WinRect]::GetForegroundWindow().ToInt64()
  $list = New-Object System.Collections.ArrayList
  $cb = {
    param($h, $l)
    if ([WinRect]::IsWindowVisible($h) -and -not [WinRect]::IsIconic($h)) {
      $len = [WinRect]::GetWindowTextLength($h)
      if ($len -gt 0) {
        $sb.Clear() | Out-Null
        [WinRect]::GetWindowText($h, $sb, 512) | Out-Null
        $r = New-Object WinRect+RECT
        [WinRect]::GetWindowRect($h, [ref]$r) | Out-Null
        $w = $r.Right - $r.Left; $hh = $r.Bottom - $r.Top
        if ($w -gt 80 -and $hh -gt 60) {
          [void]$list.Add([pscustomobject]@{ h = $h.ToInt64(); t = $sb.ToString(); x = $r.Left; y = $r.Top; w = $w; hh = $hh; fg = ($h.ToInt64() -eq $fgId) })
        }
      }
    }
    return $true
  }
  [void][WinRect]::EnumWindows($cb, [IntPtr]::Zero)
  $list | ConvertTo-Json -Compress -Depth 3
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds $IntervalMs
}
