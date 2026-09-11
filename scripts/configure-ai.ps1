$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$secret = Read-Host 'Cole sua chave da API OpenAI (entrada oculta)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:RLA_OPENAI_SETUP_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  Push-Location $projectRoot
  try { node scripts/configure-ai.cjs } finally { Pop-Location }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Item Env:RLA_OPENAI_SETUP_KEY -ErrorAction SilentlyContinue
}
Read-Host 'Pressione Enter para fechar'
