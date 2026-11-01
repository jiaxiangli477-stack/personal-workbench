$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Net.Http
$token=$env:TAVILY_API_KEY
if(-not $token){[Console]::Write('{"error":"搜索凭据未配置","code":"not_configured"}');exit 0}
try{$inputValue=[Console]::In.ReadToEnd()|ConvertFrom-Json;$query=[string]$inputValue.query;if($query.Trim().Length -lt 2 -or $query.Length -gt 200 -or $query.Contains($token) -or $query -match '(?i)\b(tvly-|sk-|Bearer\s)'){throw 'input'}}catch{[Console]::Write('{"error":"搜索关键词不合规","code":"input"}');exit 0}
$handler=[Net.Http.HttpClientHandler]::new();$handler.AllowAutoRedirect=$false;$handler.UseCookies=$false
$client=[Net.Http.HttpClient]::new($handler);$cancel=[Threading.CancellationTokenSource]::new(30000)
try{
 $client.DefaultRequestHeaders.Authorization=[Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$token)
 $payload=@{query=$query.Trim();search_depth='basic';topic='general';max_results=6;include_answer=$false;include_raw_content=$false;include_images=$false;auto_parameters=$false;include_usage=$true}|ConvertTo-Json -Compress
 $request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,'https://api.tavily.com/search');$request.Content=[Net.Http.StringContent]::new($payload,[Text.Encoding]::UTF8,'application/json')
 $response=$client.SendAsync($request,[Net.Http.HttpCompletionOption]::ResponseHeadersRead,$cancel.Token).GetAwaiter().GetResult()
 try{
  if(-not $response.IsSuccessStatusCode){@{error=('搜索服务返回 HTTP '+[int]$response.StatusCode);code='provider';httpStatus=[int]$response.StatusCode}|ConvertTo-Json -Compress;exit 0}
  $stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult();$memory=[IO.MemoryStream]::new();$buffer=New-Object byte[] 8192
  try{while($true){$n=$stream.ReadAsync($buffer,0,$buffer.Length,$cancel.Token).GetAwaiter().GetResult();if($n -eq 0){break};if($memory.Length+$n -gt 2097152){throw 'size'};$memory.Write($buffer,0,$n)};$parsed=[Text.Encoding]::UTF8.GetString($memory.ToArray())|ConvertFrom-Json}finally{$stream.Dispose();$memory.Dispose()}
  $safe=@();foreach($r in @($parsed.results)|Select-Object -First 6){$safe+=@{title=([string]$r.title).Replace($token,'[已隐藏]');url=([string]$r.url).Replace($token,'[已隐藏]');content=([string]$r.content).Replace($token,'[已隐藏]')}}
  @{results=$safe;request_id=[string]$parsed.request_id;usage=$parsed.usage}|ConvertTo-Json -Depth 8 -Compress
 }finally{$response.Dispose();$request.Dispose()}
}catch{[Console]::Write('{"error":"搜索请求未完成，可能已消耗额度；请勿自动重复","code":"uncertain"}')}
finally{$client.Dispose();$cancel.Dispose();$token=$null}
