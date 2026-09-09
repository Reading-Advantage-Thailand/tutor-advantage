# Run from the repository root on Windows. Fixed recordings keep playback
# consistent across browsers; never substitute on-device speech at test time.
$ErrorActionPreference = 'Stop'
$assessmentItems = @'
const fs = require('fs');
const ts = require('typescript');
const Module = require('module');
const filename = require('path').resolve('services/learning-service/src/services/origins2Assessment.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const bank = new Module(filename);
bank._compile(source, filename);
process.stdout.write(JSON.stringify(Object.values(bank.exports.FORMS).flat().filter(item => item.audioText)));
'@ | node | ConvertFrom-Json
Add-Type -AssemblyName System.Speech
$assessmentSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $assessmentSpeaker.SelectVoice('Microsoft Zira Desktop')
  $assessmentSpeaker.Rate = -1
  $assessmentOutput = Join-Path (Get-Location) 'apps/student-liff/public/assessment-audio'
  New-Item -ItemType Directory -Path $assessmentOutput -Force | Out-Null
  foreach ($assessmentItem in $assessmentItems) {
    $assessmentPath = Join-Path $assessmentOutput ([System.IO.Path]::GetFileName($assessmentItem.audioUrl))
    $assessmentSpeaker.SetOutputToWaveFile($assessmentPath)
    $assessmentSpeaker.Speak($assessmentItem.audioText)
    $assessmentSpeaker.SetOutputToNull()
  }
} finally { $assessmentSpeaker.Dispose() }
Write-Output 'Generated 10 fixed English listening recordings.'
