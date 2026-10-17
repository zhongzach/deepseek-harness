/**
 * Native-program argument passing for Windows PowerShell 5.1.
 *
 * 5.1 builds a native program's command line without escaping embedded double
 * quotes, drops empty-string arguments, and leaves a trailing backslash in front
 * of the quote it adds around an argument with spaces: `node -e 'f("a b")'`
 * reaches Node as two broken arguments. PowerShell 7.3+ passes arguments by the
 * Windows C runtime convention instead. {@link NATIVE_ARGUMENT_SCRIPT} gives 5.1
 * the 7.3 behavior for `.exe` programs, keeping the 7.3 exceptions (`cmd.exe`,
 * `cscript.exe`, `find.exe`, `sqlcmd.exe`, `wscript.exe`, and every non-`.exe`
 * script such as `.cmd`/`.bat`) on the old rules:
 *
 * - A post-command-lookup hook swaps each such program for a small function that
 *   quotes every argument by the C runtime rules, sets the joined command line in
 *   an environment variable and calls the program through `--% %VAR%`, the only
 *   5.1 path that hands a command line over verbatim. The program therefore sees
 *   one extra variable, `__DSH_NATIVE_ARGV`, holding its own arguments.
 * - Pipeline input, `$LASTEXITCODE` and `$?` behave as for a direct call; the
 *   function marks its caller's pipeline failed when the program exits nonzero,
 *   through the frozen 5.1 engine internals (best effort: without them `$?` stays
 *   true and `$LASTEXITCODE` still reports the code).
 * - What 5.1 already passed intact is left as it was: a `-name:value` token stays
 *   one argument, a command's own `--%` text goes through verbatim, and an argument
 *   whose every double quote is backslash-escaped (written for 5.1, like
 *   `'{\"a\":1}'`) is read as already escaped rather than escaped again.
 * - A script-block argument (as `powershell -Command { … }` takes) keeps the old
 *   path, which knows how to encode it.
 *
 * The script lives in a private temporary file that each command loads in one
 * short statement: the command line stays as short as before, because security
 * software on Windows may hold up every program a PowerShell started with a long
 * command line (about 0.5 s per launch past ~2,000 characters, measured on a
 * Defender host). Everything is guarded, so a host without the full language, a
 * PowerShell other than 5.x, or a missing file keeps the old behavior.
 * @module @deepseek-ai/dsh-pwsh-local/native-arguments
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, win32 } from 'node:path'

/** The installer Windows PowerShell 5.1 runs before each command. */
export const NATIVE_ARGUMENT_SCRIPT = String.raw`# Windows PowerShell 5.1: pass native-program arguments by the Windows C runtime
# convention, as PowerShell 7.3+ does (@deepseek-ai/dsh-pwsh-local/native-arguments).
if ($PSVersionTable.PSVersion.Major -ge 6 -or $ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') { return }

# One argument by the C runtime rules. An argument whose every double quote is
# already backslash-escaped was written for the old passing: take it as escaped.
function global:__dshQuoteArg([string]$a) {
  if ($a.IndexOf('"') -ge 0 -and $a -notmatch '(?<!\\)(?:\\\\)*"') {
    $a = [regex]::Replace($a, '(\\+)"', { param($m) '\' * (($m.Groups[1].Length - 1) / 2) + '"' })
  }
  if ($a -ne '' -and $a -notmatch '[\s"]') { return $a }
  '"' + [regex]::Replace($a, '(\\*)("|\z)', { param($m) $m.Groups[1].Value * 2 + '\"' * $m.Groups[2].Length }) + '"'
}

# The command line for one call: $null keeps the old path (a script-block argument), '' is none.
function global:__dshNativeArgs([object[]]$list) {
  $out = [System.Collections.Generic.List[string]]::new()
  for ($i = 0; $i -lt $list.Count; $i++) {
    $a = $list[$i]
    # The command's own stop-parsing text goes through as 5.1 sends it.
    if ($a -is [string] -and $a -eq '--%') {
      if ($i + 1 -lt $list.Count) { $out.Add([Environment]::ExpandEnvironmentVariables([string]$list[$i + 1])) }
      break
    }
    # -name:value arrives here as two values; 5.1 sends it as one argument.
    if ($a -is [string] -and $a -match '^-[^\s"]+:$' -and $i + 1 -lt $list.Count -and $list[$i + 1] -isnot [System.Collections.IList]) {
      $i++
      $a += [string]$list[$i]
    }
    foreach ($v in @($a)) {
      if ($v -is [scriptblock]) { return $null }
      if ($null -ne $v) { $out.Add((__dshQuoteArg ([string]$v))) }
    }
  }
  $out -join ' '
}

# $? for the caller: a program exiting nonzero fails the pipeline its stand-in runs
# in, as a direct call does. 5.1 is frozen, so these engine internals hold still;
# without them $? stays true and $LASTEXITCODE still reports the code.
$global:__dshFlags = [Reflection.BindingFlags]'Instance,NonPublic,Public'
try {
  $global:__dshEngine = $ExecutionContext.GetType().GetField('_context', $global:__dshFlags).GetValue($ExecutionContext)
  $global:__dshCurrent = $global:__dshEngine.GetType().GetProperty('CurrentCommandProcessor', $global:__dshFlags)
} catch { $global:__dshCurrent = $null }
function global:__dshFail($processor) {
  try {
    $runtime = $processor.GetType().GetProperty('CommandRuntime', $global:__dshFlags).GetValue($processor)
    $pipeline = $runtime.GetType().GetProperty('PipelineProcessor', $global:__dshFlags).GetValue($runtime)
    $pipeline.GetType().GetProperty('ExecutionFailed', $global:__dshFlags).SetValue($pipeline, $true)
  } catch {}
}

# The stand-in for one program (slot ~I~ of $global:__dshNativeApps). --% hands the
# command line over verbatim and takes the rest of its line, so each such call ends one.
$global:__dshNativeShim = @'
$__self = if ($global:__dshCurrent) { $global:__dshCurrent.GetValue($global:__dshEngine) }
$__app = $global:__dshNativeApps[~I~]
$__line = __dshNativeArgs $args
if ($null -eq $__line) {
  if ($MyInvocation.ExpectingInput) { $input | & $__app @args } else { & $__app @args }
} elseif ($__line -eq '') {
  if ($MyInvocation.ExpectingInput) { $input | & $__app } else { & $__app }
} else {
  $env:__DSH_NATIVE_ARGV = $__line
  if ($MyInvocation.ExpectingInput) { $input | & $__app --% %__DSH_NATIVE_ARGV%
  } else { & $__app --% %__DSH_NATIVE_ARGV%
  }
  [Environment]::SetEnvironmentVariable('__DSH_NATIVE_ARGV', $null)
}
if ($LASTEXITCODE) { __dshFail $__self }
'@
$global:__dshNativeApps = [System.Collections.Generic.List[object]]::new()
$global:__dshNativeShims = @{}

# PowerShell 7.3 keeps these on the old rules: they read their command line themselves.
$global:__dshLegacyNative = 'cmd.exe', 'cscript.exe', 'find.exe', 'sqlcmd.exe', 'wscript.exe'
$ExecutionContext.InvokeCommand.PostCommandLookupAction = {
  param($name, $lookup)
  $app = $lookup.Command
  if ($app -is [System.Management.Automation.ApplicationInfo] -and $app.Extension -eq '.exe' -and $global:__dshLegacyNative -notcontains $app.Name) {
    $shim = $global:__dshNativeShims[$app.Path]
    if ($null -eq $shim) {
      $global:__dshNativeApps.Add($app)
      $shim = [scriptblock]::Create($global:__dshNativeShim.Replace('~I~', [string]($global:__dshNativeApps.Count - 1)))
      $global:__dshNativeShims[$app.Path] = $shim
    }
    $lookup.CommandScriptBlock = $shim
  }
}
`

/**
 * Whether an executable is Windows PowerShell (5.1, `powershell.exe`) rather than
 * PowerShell 7 (`pwsh.exe`), the one whose native-argument passing needs the script.
 * @param executable - the resolved shell executable.
 */
export function isWindowsPowerShell(executable: string): boolean {
  return win32.basename(executable).toLowerCase() === 'powershell.exe'
}

/** The private directory holding this process's copy of the script, once written. */
let scriptDirectory: string | undefined

// Best-effort removal at a JavaScript-observable exit; a killed process leaves the
// tiny file to OS temp hygiene.
/* v8 ignore next 4 -- exit listeners run after the coverage dump. */
process.once('exit', () => {
  if (scriptDirectory === undefined) return
  try { rmSync(scriptDirectory, { recursive: true, force: true }) } catch { /* best-effort */ }
})

/**
 * This process's copy of {@link NATIVE_ARGUMENT_SCRIPT}, written on first use into a
 * private (`mkdtemp`) directory and rewritten when a temp cleaner removed it.
 * @returns the script's path, or undefined when it cannot be written.
 */
export function nativeArgumentScriptFile(): string | undefined {
  if (scriptDirectory !== undefined) {
    const file = join(scriptDirectory, 'native-arguments.ps1')
    if (existsSync(file)) return file
  }
  try {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-pwsh-'))
    const file = join(directory, 'native-arguments.ps1')
    writeFileSync(file, NATIVE_ARGUMENT_SCRIPT, 'utf8')
    scriptDirectory = directory
    return file
  } catch {
    return undefined
  }
}

/** PowerShell single-quoted literal. */
const literal = (text: string): string => `'${text.replaceAll("'", "''")}'`

/**
 * Everything placed before a command for one executable: the encoding preamble,
 * then — for Windows PowerShell — one statement loading the native-argument script.
 * @param executable - the resolved shell executable.
 * @param encoding - the encoding preamble (owned by the executor module).
 */
export function commandPreamble(executable: string, encoding: string): string {
  if (!isWindowsPowerShell(executable)) return encoding
  const file = nativeArgumentScriptFile()
  return file === undefined ? encoding : `${encoding}try { . ([scriptblock]::Create([IO.File]::ReadAllText(${literal(file)}))) } catch {}; `
}
