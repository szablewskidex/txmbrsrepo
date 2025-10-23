$apiKey = "AIzaSyAuyebJBmwDuO7-kNIbVWwiFaffRUs_MSc"
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"

$body = @{
    contents = @(
        @{
            parts = @(
                @{
                    text = "Say hello in one word"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Testing Gemini 2.5 Flash..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    Write-Host "SUCCESS! API works correctly:" -ForegroundColor Green
    $response.candidates[0].content.parts[0].text
} catch {
    Write-Host "ERROR:" -ForegroundColor Red
    $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response:" -ForegroundColor Yellow
        $responseBody
    }
}
