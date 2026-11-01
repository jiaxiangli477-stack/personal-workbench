param([Parameter(Mandatory=$true)][string]$Url,[int]$TimeoutMs=10000)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Net.Http
function Assert-PublicTarget([Uri]$Target) {
  if($Target.Scheme -ne 'https' -or $Target.Host -notin @('packrivo.com','www.packrivo.com') -or $Target.UserInfo -or $Target.Port -ne 443 -or $Target.Query -or $Target.Fragment){throw 'Only fixed Packrivo public HTTPS endpoints are allowed'}
  foreach($address in [Net.Dns]::GetHostAddresses($Target.Host)) {
    if($address.IsIPv4MappedToIPv6){$address=$address.MapToIPv4()}
    if([Net.IPAddress]::IsLoopback($address)){throw 'Private network target refused'}
    $b=$address.GetAddressBytes()
    if($b.Length -eq 4){if($b[0] -in @(0,10,127) -or $b[0] -ge 224 -or ($b[0] -eq 169 -and $b[1] -eq 254) -or ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31) -or ($b[0] -eq 192 -and $b[1] -eq 168)){throw 'Private network target refused'}}
    elseif(($b[0] -band 254) -eq 252 -or ($b[0] -eq 254 -and ($b[1] -band 192) -eq 128) -or $b[0] -eq 255 -or $address.Equals([Net.IPAddress]::IPv6Any)){throw 'Private network target refused'}
  }
}
$timer=[Diagnostics.Stopwatch]::StartNew()
$handler=[Net.Http.HttpClientHandler]::new();$handler.AllowAutoRedirect=$false;$handler.UseCookies=$false
$client=[Net.Http.HttpClient]::new($handler);$client.DefaultRequestHeaders.UserAgent.ParseAdd('PersonalWorkbench-LocalHealth/0.5')
$cancel=[Threading.CancellationTokenSource]::new([Math]::Max(1,$TimeoutMs))
try {
  $target=[Uri]$Url
  for($redirect=0;$redirect -le 3;$redirect++) {
    Assert-PublicTarget $target
    $response=$client.GetAsync($target,[Net.Http.HttpCompletionOption]::ResponseHeadersRead,$cancel.Token).GetAwaiter().GetResult()
    try {
      $status=[int]$response.StatusCode
      if($status -ge 300 -and $status -lt 400 -and $response.Headers.Location){if($redirect -eq 3){throw 'Too many redirects'};$target=[Uri]::new($target,$response.Headers.Location);continue}
      $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult();$buffer=New-Object byte[] 8192;$memory=[IO.MemoryStream]::new()
      try {while($memory.Length -lt 131072){$count=$stream.ReadAsync($buffer,0,[Math]::Min($buffer.Length,131072-[int]$memory.Length),$cancel.Token).GetAwaiter().GetResult();if($count -eq 0){break};$memory.Write($buffer,0,$count)};$text=[Text.Encoding]::UTF8.GetString($memory.ToArray())}finally{$stream.Dispose();$memory.Dispose()}
      $match=[regex]::Match($text,'<title[^>]*>(.*?)</title>','Singleline,IgnoreCase');$title=[Net.WebUtility]::HtmlDecode(($match.Groups[1].Value -replace '\s+',' ').Trim());if($title.Length -gt 180){$title=$title.Substring(0,180)}
      [ordered]@{statusCode=$status;finalUrl=$target.AbsoluteUri;durationMs=$timer.ElapsedMilliseconds;title=$title;challenge=($text -match 'cf-chl-|challenge-platform|Just a moment\.\.\.');certificate=@{httpsValidated=$true;validTo=$null};transport='windows-system'} | ConvertTo-Json -Compress -Depth 4
      exit 0
    }finally{$response.Dispose()}
  }
}finally{$client.Dispose();$cancel.Dispose()}
