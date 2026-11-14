$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
function Report([string]$Status, [string]$Detail) { @{ status = $Status; detail = $Detail } | ConvertTo-Json -Compress | Write-Output }
$ownedWindow = [IntPtr]::Zero
try {
  $package = Get-AppxPackage -Name Microsoft.PPIProjection | Select-Object -First 1
  if (-not $package) { Report 'unavailable' 'Windows Wireless Display is not installed.'; exit 0 }
  $null = [Windows.Media.Miracast.MiracastReceiver, Windows.Media.Miracast, ContentType=WindowsRuntime]
  $receiver = New-Object Windows.Media.Miracast.MiracastReceiver
  $status = $receiver.GetStatus()
  if ([int]$status.WiFiStatus -lt 2) { Report 'unavailable' ('Miracast Wi-Fi status: ' + $status.WiFiStatus); exit 0 }
  # The OS receiver owns the Wi-Fi Direct negotiation and native stream window.
  # No registry settings, firewall policies, projection permissions or OS features are changed.
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BifrostProjection {
  [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IActivationManager {
    [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appId, [MarshalAs(UnmanagedType.LPWStr)] string args, uint options, out uint pid);
    [PreserveSig] int ActivateForFile(IntPtr items, [MarshalAs(UnmanagedType.LPWStr)] string verb, out uint pid);
    [PreserveSig] int ActivateForProtocol(IntPtr items, out uint pid);
  }
  [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")] class ActivationManager {}
  public delegate bool EnumProc(IntPtr handle, IntPtr parameter);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr handle, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr handle, uint message, IntPtr wparam, IntPtr lparam);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int id);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool PeekNamedPipe(IntPtr handle, IntPtr data, uint size, IntPtr read, out uint available, IntPtr left);
  public static bool StopRequested() { uint available; return !PeekNamedPipe(GetStdHandle(-10), IntPtr.Zero, 0, IntPtr.Zero, out available, IntPtr.Zero) || available > 0; }
  public static uint Activate(string id) { uint pid; var manager=(IActivationManager)new ActivationManager(); Marshal.ThrowExceptionForHR(manager.ActivateApplication(id, "", 6, out pid)); return pid; }
  public static IntPtr FindWindow(uint pid) {
    IntPtr found=IntPtr.Zero;
    EnumProc find=(handle, parameter)=>{ uint owner; GetWindowThreadProcessId(handle, out owner); if(owner==pid) { found=GetAncestor(handle,2); return false; } return true; };
    EnumWindows((handle, parameter)=>{ find(handle,parameter); if(found==IntPtr.Zero) EnumChildWindows(handle,find,IntPtr.Zero); return found==IntPtr.Zero; },IntPtr.Zero);
    return found;
  }
}
'@
  $manifest = Get-AppxPackageManifest -Package $package.PackageFullName
  $application = @($manifest.Package.Applications.Application)[0]
  $appId = $package.PackageFamilyName + '!' + $application.Id
  $alreadyListening = @(1,2,3) -contains [int]$status.ListeningStatus
  if ($alreadyListening) { Report 'ready' 'Windows Wireless Display is already listening.'; exit 0 }
  $projectionPid = [BifrostProjection]::Activate($appId)
  Report 'starting' 'Windows Wireless Display is starting.'
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $handle = [BifrostProjection]::FindWindow($projectionPid)
    if ($handle -ne [IntPtr]::Zero) { if (-not $alreadyListening) { $ownedWindow = $handle; [void][BifrostProjection]::ShowWindowAsync($handle, 6) }; break }
    Start-Sleep -Milliseconds 250
  }
  $wasConnected = $false
  $lastStatus = ''
  while (-not [BifrostProjection]::StopRequested()) {
    $status = $receiver.GetStatus()
    $listening = [int]$status.ListeningStatus
    $current = if (@(1,2,3) -contains $listening) { 'ready' } else { 'unavailable' }
    if ($current -ne $lastStatus) { Report $current ('Windows Wireless Display: ' + $status.ListeningStatus); $lastStatus = $current }
    $connected = $listening -eq 3
    if ($connected -and -not $wasConnected) { $handle = [BifrostProjection]::FindWindow($projectionPid); if ($handle -ne [IntPtr]::Zero) { [void][BifrostProjection]::ShowWindowAsync($handle, 9); [void][BifrostProjection]::SetForegroundWindow($handle) } }
    if (-not $connected -and $wasConnected -and $ownedWindow -ne [IntPtr]::Zero) { [void][BifrostProjection]::ShowWindowAsync($ownedWindow, 6) }
    $wasConnected = $connected
    Start-Sleep -Milliseconds 750
  }
} catch { Report 'unavailable' $_.Exception.Message }
finally { if ($ownedWindow -ne [IntPtr]::Zero) { [void][BifrostProjection]::PostMessage($ownedWindow, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) } }
