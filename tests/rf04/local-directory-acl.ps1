$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Windows-only synthetic ACL test.' }
$workspace = 'C:\Work\SideProject\ApplyTrack'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
if ($root -ne $workspace) { throw 'Unexpected workspace; no ACL changes permitted.' }

$tmp = Join-Path $root 'tmp'
$realBackup = Join-Path $tmp 'rf04-backup.local'
if (-not (Test-Path -LiteralPath $tmp -PathType Container)) { throw 'Existing tmp parent required.' }
foreach ($path in @($root, $tmp, $realBackup)) {
  if (Test-Path -LiteralPath $path) {
    if ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw 'Reparse point boundary; no changes permitted.'
    }
  }
}

$access = [Security.AccessControl.AccessControlSections]::Access
$sections = $access -bor [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Group
$tmpBefore = (Get-Acl -LiteralPath $tmp).GetSecurityDescriptorSddlForm($sections)
$backupBefore = if (Test-Path -LiteralPath $realBackup) { (Get-Acl -LiteralPath $realBackup).GetSecurityDescriptorSddlForm($sections) }
$operator = [Security.Principal.WindowsIdentity]::GetCurrent().User
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$administrators = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$allowed = @($operator.Value, $system.Value, $administrators.Value) | Sort-Object -Unique
$id = [guid]::NewGuid().ToString('N')
$parent = Join-Path $tmp "rf04-acl-synthetic-$id"
$private = Join-Path $parent 'private'
$marker = Join-Path $parent 'SYNTHETIC_ONLY.txt'
$sample = Join-Path $private 'sample.txt'
$parentOriginal = $null
$privateOriginal = $null
$created = $false
$passed = 0

function Check([bool]$condition, [string]$label) {
  if (-not $condition) { throw "FAIL: $label" }
  $script:passed++
  Write-Output "PASS: $label"
}
function CheckPrivateAcl([string]$path, [bool]$protected) {
  $acl = Get-Acl -LiteralPath $path
  Check ($acl.AreAccessRulesProtected -eq $protected) 'expected inheritance mode'
  $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
  Check ($rules.Count -eq $allowed.Count) 'only operator, SYSTEM and Administrators entries'
  foreach ($sid in $allowed) {
    $matches = @($rules | Where-Object { $_.IdentityReference.Value -eq $sid })
    Check ($matches.Count -eq 1 -and $matches[0].AccessControlType -eq 'Allow' -and $matches[0].FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl) 'required principal retains full control'
  }
}
function RestoreDacl([string]$path, [Security.AccessControl.DirectorySecurity]$original) {
  # Fresh fixture baselines are inherited-only; use DACL-only native rollback.
  if ($path -ne $parent -and $path -ne $private) { throw 'Rollback outside synthetic scope.' }
  if ($original.AreAccessRulesProtected -or @($original.Access | Where-Object { -not $_.IsInherited }).Count) { throw 'Unexpected baseline; reset is not an exact rollback.' }
  $null = & icacls.exe $path /inheritance:e /q 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic inheritance rollback failed.' }
  $null = & icacls.exe $path /reset /q 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic DACL reset failed.' }
}

try {
  if (Test-Path -LiteralPath $parent) { throw 'Synthetic target already exists.' }
  New-Item -ItemType Directory -Path $parent | Out-Null
  $created = $true
  Set-Content -LiteralPath $marker -Value "RF04-ACL-SYNTHETIC-$id" -NoNewline
  New-Item -ItemType Directory -Path $private | Out-Null
  $parentOriginal = Get-Acl -LiteralPath $parent
  $privateOriginal = Get-Acl -LiteralPath $private
  foreach ($original in @($parentOriginal, $privateOriginal)) {
    if ($original.AreAccessRulesProtected -or @($original.Access | Where-Object { -not $_.IsInherited }).Count) { throw 'Unexpected fixture baseline; no ACL change permitted.' }
  }
  $privateBefore = $privateOriginal.GetSecurityDescriptorSddlForm($sections)

  # Fresh DACL removes broad inherited entries only on this disposable directory.
  $dacl = [Security.AccessControl.DirectorySecurity]::new()
  $dacl.SetOwner($operator)
  $dacl.SetAccessRuleProtection($true, $false)
  $inheritance = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit
  foreach ($sid in @($operator, $system, $administrators)) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', $inheritance, 'None', 'Allow')
    $dacl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $private -AclObject $dacl
  CheckPrivateAcl $private $true
  Set-Content -LiteralPath $sample -Value 'fabricated ACL probe only' -NoNewline
  Check ((Get-Content -LiteralPath $sample -Raw) -eq 'fabricated ACL probe only') 'operator file write/read'
  CheckPrivateAcl $sample $false
  $protectedBefore = (Get-Acl -LiteralPath $private).GetSecurityDescriptorSddlForm($sections)

  $changedParent = Get-Acl -LiteralPath $parent
  $everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
  $changedParent.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, 'ReadAndExecute', $inheritance, 'None', 'Allow'))
  Set-Acl -LiteralPath $parent -AclObject $changedParent
  Check ((Get-Acl -LiteralPath $private).GetSecurityDescriptorSddlForm($sections) -eq $protectedBefore) 'protected DACL unchanged after disposable parent grant'
  CheckPrivateAcl $sample $false

  RestoreDacl $parent $parentOriginal
  RestoreDacl $private $privateOriginal
  Check ((Get-Acl -LiteralPath $private).GetSecurityDescriptorSddlForm($sections) -eq $privateBefore) 'exact original owner/group/DACL restored'
  Check ((Get-Acl -LiteralPath $private).AreAccessRulesProtected -eq $privateOriginal.AreAccessRulesProtected) 'original inheritance restored'
} finally {
  if ($created) {
    if (-not [IO.Path]::GetFullPath($parent).StartsWith($tmp + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup boundary mismatch.' }
    foreach ($path in @($parent, $private, $marker, $sample)) {
      if (Test-Path -LiteralPath $path) {
        if ((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Cleanup refused: reparse point.' }
      }
    }
    if ((Get-Content -LiteralPath $marker -Raw) -ne "RF04-ACL-SYNTHETIC-$id") { throw 'Cleanup refused: marker mismatch.' }
    if ($parentOriginal) { RestoreDacl $parent $parentOriginal }
    if ($privateOriginal -and (Test-Path -LiteralPath $private)) { RestoreDacl $private $privateOriginal }
    if (Test-Path -LiteralPath $sample) { Remove-Item -LiteralPath $sample }
    # Non-recursive removal fails closed if an unexpected file was introduced.
    if (Test-Path -LiteralPath $private) {
      if (@(Get-ChildItem -LiteralPath $private -Force).Count) { throw 'Cleanup refused: unexpected private contents.' }
      Remove-Item -LiteralPath $private
    }
    if (@(Get-ChildItem -LiteralPath $parent -Force | Where-Object Name -ne 'SYNTHETIC_ONLY.txt').Count) { throw 'Cleanup refused: unexpected parent contents.' }
    Remove-Item -LiteralPath $marker
    Remove-Item -LiteralPath $parent
  }
  Check ((Get-Acl -LiteralPath $tmp).GetSecurityDescriptorSddlForm($sections) -eq $tmpBefore) 'existing tmp parent ACL unchanged'
  if ($backupBefore) { Check ((Get-Acl -LiteralPath $realBackup).GetSecurityDescriptorSddlForm($sections) -eq $backupBefore) 'existing backup directory ACL unchanged' }
}
Check (-not (Test-Path -LiteralPath $parent)) 'only disposable synthetic artifacts cleaned'
Write-Output "Synthetic ACL rehearsal completed: $passed checks. No account identifiers logged."
