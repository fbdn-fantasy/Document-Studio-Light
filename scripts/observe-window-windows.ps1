param([Parameter(Mandatory)][string]$Application,[Parameter(Mandatory)][string]$Profile,[Parameter(Mandatory)][string]$Report)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativeWindowObservation {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd,out Rect rect);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd,uint msg,IntPtr wparam,IntPtr lparam);
 [DllImport("user32.dll",EntryPoint="GetClassLongPtrW")] public static extern IntPtr GetClassLongPtr(IntPtr hwnd,int index);
}
'@
$profilePath=[IO.Path]::GetFullPath($Profile)
New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
$start=[Diagnostics.ProcessStartInfo]::new([IO.Path]::GetFullPath($Application))
$start.UseShellExecute=$false
$start.Environment['FTE_TEST_DATA']=$profilePath
$process=[Diagnostics.Process]::Start($start)
$timer=[Diagnostics.Stopwatch]::StartNew()
$samples=[Collections.Generic.List[object]]::new()
$first=$null
while($timer.Elapsed.TotalSeconds -lt 60){
 $process.Refresh()
 if($process.HasExited){throw "App exited with code $($process.ExitCode) before observation finished"}
 $handle=$process.MainWindowHandle
 if($handle -ne [IntPtr]::Zero -and $process.MainWindowTitle -like '*Document Studio*' -and [NativeWindowObservation]::IsWindowVisible($handle)){
  $client=[NativeWindowObservation+Rect]::new();$outer=[NativeWindowObservation+Rect]::new()
  [NativeWindowObservation]::GetClientRect($handle,[ref]$client) | Out-Null
  [NativeWindowObservation]::GetWindowRect($handle,[ref]$outer) | Out-Null
  $sample=[ordered]@{milliseconds=$timer.ElapsedMilliseconds;width=$client.Right;height=$client.Bottom;outerWidth=$outer.Right-$outer.Left;outerHeight=$outer.Bottom-$outer.Top;maximized=[NativeWindowObservation]::IsZoomed($handle)}
  if($null -eq $first){$first=$timer.ElapsedMilliseconds}
  if($samples.Count -eq 0 -or $samples[$samples.Count-1].width -ne $sample.width -or $samples[$samples.Count-1].height -ne $sample.height){$samples.Add($sample)}
  if($timer.ElapsedMilliseconds-$first -gt 2000){break}
 }
 Start-Sleep -Milliseconds 10
}
if($samples.Count -eq 0){throw 'No visible application window within 60 seconds'}
$icon=[NativeWindowObservation]::SendMessage($handle,0x007F,[IntPtr]1,[IntPtr]::Zero)
if($icon -eq [IntPtr]::Zero){$icon=[NativeWindowObservation]::SendMessage($handle,0x007F,[IntPtr]2,[IntPtr]::Zero)}
if($icon -eq [IntPtr]::Zero){$icon=[NativeWindowObservation]::GetClassLongPtr($handle,-14)}
$result=[ordered]@{pid=$process.Id;profile=$profilePath;visibleGeometryChanges=$samples;iconPresent=($icon -ne [IntPtr]::Zero);samplingMilliseconds=10}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Report
$result | ConvertTo-Json -Depth 8
