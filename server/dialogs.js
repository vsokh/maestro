import { execFile } from 'node:child_process';
import { homedir, platform } from 'node:os';

// --- Native folder dialog ---

function openNativeFolderDialog() {
  return new Promise((resolve, reject) => {
    const os = platform();
    if (os === 'win32') {
      const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FOD {}

[ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileOpenDialog {
  [PreserveSig] int Show(IntPtr hwnd);
  void SetFileTypes(uint c, IntPtr f);
  void SetFileTypeIndex(uint i);
  void GetFileTypeIndex(out uint i);
  void Advise(IntPtr e, out uint k);
  void Unadvise(uint k);
  void SetOptions(uint o);
  void GetOptions(out uint o);
  void SetDefaultFolder(IShellItem i);
  void SetFolder(IShellItem i);
  void GetFolder(out IShellItem i);
  void GetCurrentSelection(out IShellItem i);
  void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n);
  void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
  void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
  void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
  void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
  void GetResult(out IShellItem i);
  void AddPlace(IShellItem i, int p);
  void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string e);
  void Close(int r);
  void SetClientGuid([In] ref Guid g);
  void ClearClientData();
  void SetFilter(IntPtr f);
  void GetResults(out IntPtr e);
  void GetSelectedItems(out IntPtr e);
}

[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItem {
  void BindToHandler(IntPtr p, [MarshalAs(UnmanagedType.LPStruct)] Guid b, [MarshalAs(UnmanagedType.LPStruct)] Guid r, out IntPtr v);
  void GetParent(out IShellItem i);
  void GetDisplayName(uint n, [MarshalAs(UnmanagedType.LPWStr)] out string s);
  void GetAttributes(uint m, out uint a);
  void Compare(IShellItem i, uint h, out int o);
}

public class Picker {
  public static string Run() {
    var d = (IFileOpenDialog)new FOD();
    d.SetTitle("Select a project folder");
    d.SetOptions(0x20 | 0x40);
    if (d.Show(IntPtr.Zero) != 0) return null;
    IShellItem r; d.GetResult(out r);
    string p; r.GetDisplayName(0x80058000u, out p);
    return p;
  }
}
'@

$r = [Picker]::Run()
if ($r) { Write-Output $r } else { Write-Output '' }
`;
      execFile('powershell', ['-NoProfile', '-STA', '-Command', script], { timeout: 60000 }, (err, stdout) => {
        if (err) return reject(err);
        const path = stdout.trim();
        resolve(path || null);
      });
    } else if (os === 'darwin') {
      const script = 'osascript -e \'tell application "Finder" to set f to POSIX path of (choose folder with prompt "Select a project folder")\' 2>/dev/null';
      execFile('bash', ['-c', script], { timeout: 60000 }, (err, stdout) => {
        if (err) return resolve(null); // user cancelled
        resolve(stdout.trim() || null);
      });
    } else {
      // Linux — try zenity, then kdialog
      execFile('zenity', ['--file-selection', '--directory', '--title=Select a project folder'], { timeout: 60000 }, (err, stdout) => {
        if (err) {
          execFile('kdialog', ['--getexistingdirectory', homedir(), '--title', 'Select a project folder'], { timeout: 60000 }, (err2, stdout2) => {
            if (err2) return resolve(null);
            resolve(stdout2.trim() || null);
          });
          return;
        }
        resolve(stdout.trim() || null);
      });
    }
  });
}

export { openNativeFolderDialog };
