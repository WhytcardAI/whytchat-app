; Inno Setup Script for Whytchat Desktop Application
; Author: Generated for Whytchat v2
; Architecture: Tauri + React + TypeScript + Rust

#define MyAppName "Whytchat"
#define MyAppVersion "0.2.1"
#define MyAppPublisher "Whytcard"
#define MyAppURL "https://whytcard.com"
#define MyAppExeName "whytchat-desktop.exe"
#define MyAppId "ai.whytcard.whytchat"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
; Do not use the same AppId value in installers for other applications.
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
SetupIconFile=src-tauri\icons\icon.ico
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Output directory for the installer
OutputDir=installer-output
OutputBaseFilename=Whytchat-Setup-{#MyAppVersion}
; Compression settings
Compression=lzma
SolidCompression=yes
; Require admin privileges for Program Files installation
PrivilegesRequired=admin
; Modern UI
WizardStyle=modern
; Show language selection dialog
ShowLanguageDialog=yes
; Always show destination folder selection page
DisableDirPage=no
; Architectures
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
; No icon tasks (no writes outside install dir)

[Files]
; Main application executable (from Tauri build)
Source: ".tauri-target\release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; Application resources and assets
Source: ".tauri-target\release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.pdb,*.exp,*.lib,*.ilk"
; Frontend build output (in case assets are not fully embedded)
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
; Llama-server binary and DLLs
Source: "llama-bin\*"; DestDir: "{app}\llama-bin"; Flags: ignoreversion recursesubdirs createallsubdirs
; Models directory
Source: "models\*"; DestDir: "{app}\models"; Flags: ignoreversion recursesubdirs createallsubdirs; Tasks: ; Excludes: "*.gguf"
; License files
Source: "LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
; Create data directory for SQLite database
Name: "{app}\data"

[Icons]
; No icons created (respect policy: no files outside {app})

[Run]
; Launch application after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove user data directory on uninstall (optional - comment out to preserve data)
Type: filesandordirs; Name: "{app}\data"

[CustomMessages]
english.LaunchProgram=Launch Whytchat
english.CreateDesktopIcon=Create a desktop icon
english.CreateQuickLaunchIcon=Create a Quick Launch icon
english.AdditionalIcons=Additional icons:
english.DownloadingDependencies=Downloading required components...
english.InstallingDependencies=Installing dependencies...

french.LaunchProgram=Lancer Whytchat
french.CreateDesktopIcon=Créer une icône sur le bureau
french.CreateQuickLaunchIcon=Créer une icône de lancement rapide
french.AdditionalIcons=Icônes supplémentaires :
french.DownloadingDependencies=Téléchargement des composants requis...
french.InstallingDependencies=Installation des dépendances...

[Code]
var
  DownloadPage: TDownloadWizardPage;

// Check if WebView2 is installed
function IsWebView2Installed(): Boolean;
begin
  Result := RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9B7C3E8}') or
            RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9B7C3E8}') or
            RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\WOW6432Node\Microsoft\EdgeWebView') or
            RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\Microsoft\EdgeWebView');
end;

// Check if Visual C++ Redistributable 2015-2022 x64 is installed
function IsVCRedistInstalled(): Boolean;
var
  Version: String;
begin
  // Check for VC++ 2015-2022 x64 (version 14.x)
  Result := RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Version', Version) or
            RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Version', Version);
end;

// Initialize download page
procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage(SetupMessage(msgWizardPreparing), SetupMessage(msgPreparingDesc), nil);
end;

// Add required downloads
function NextButtonClick(CurPageID: Integer): Boolean;
var
  WebView2TempPath, VCRedistTempPath: String;
begin
  Result := True;
  
  if CurPageID = wpReady then
  begin
    DownloadPage.Clear;
    
    // Download WebView2 if not installed
    if not IsWebView2Installed() then
    begin
      WebView2TempPath := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
      DownloadPage.Add('https://go.microsoft.com/fwlink/p/?LinkId=2124703', 'MicrosoftEdgeWebview2Setup.exe', '');
    end;
    
    // Download VC++ Redistributable if not installed
    if not IsVCRedistInstalled() then
    begin
      VCRedistTempPath := ExpandConstant('{tmp}\VC_redist.x64.exe');
      DownloadPage.Add('https://aka.ms/vs/17/release/vc_redist.x64.exe', 'VC_redist.x64.exe', '');
    end;
    
    // Download if there are pending downloads
    if DownloadPage.Count > 0 then
    begin
      DownloadPage.Show;
      try
        DownloadPage.Download;
        Result := True;
      except
        Result := False;
        MsgBox('Failed to download required components. Please check your internet connection and try again.', mbError, MB_OK);
      end;
    end;
  end;
end;

// Install downloaded dependencies
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  WebView2Path, VCRedistPath: String;
begin
  if CurStep = ssPostInstall then
  begin
    WebView2Path := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
    VCRedistPath := ExpandConstant('{tmp}\VC_redist.x64.exe');
    
    // Install WebView2 silently
    if FileExists(WebView2Path) then
    begin
      Exec(WebView2Path, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
    
    // Install VC++ Redistributable silently
    if FileExists(VCRedistPath) then
    begin
      Exec(VCRedistPath, '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;
