$api = 'http://localhost:4000/api/v1'
$pass = 0; $fail = 0

function Check($name, $expected, [scriptblock]$call) {
  try {
    $status = (& $call).StatusCode
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
  }
  if ($status -eq $expected) {
    Write-Host "PASS  $name ($status)" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "FAIL  $name (expected $expected, got $status)" -ForegroundColor Red
    $script:fail++
  }
}

function Post($path, $body, $headers = @{}) {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$api$path" `
    -ContentType 'application/json' -Body $body -Headers $headers
}
function Get($path, $headers = @{}) {
  Invoke-WebRequest -UseBasicParsing -Uri "$api$path" -Headers $headers
}

function Patch($path, $body, $headers = @{}) {
  Invoke-WebRequest -UseBasicParsing -Method Patch -Uri "$api$path" `
    -ContentType 'application/json' -Body $body -Headers $headers
}
function DeleteRequest($path, $headers = @{}) {
  Invoke-WebRequest -UseBasicParsing -Method Delete -Uri "$api$path" -Headers $headers
}

# --- Log in as customer and admin ---
$cust = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' `
  -Body (@{ email = 'customer1@example.com'; password = 'Password123!' } | ConvertTo-Json)
$admin = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' `
  -Body (@{ email = 'admin@example.com'; password = 'Password123!' } | ConvertTo-Json)
$custH  = @{ Authorization = "Bearer $($cust.accessToken)" }
$adminH = @{ Authorization = "Bearer $($admin.accessToken)" }
$badH   = @{ Authorization = "Bearer $($cust.accessToken)x" }

Write-Host "`n--- Health ---"
Check 'health check'              200 { Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4000/health' }
Check 'unknown route'             404 { Get '/does-not-exist' }

Write-Host "`n--- Auth ---"
Check 'register: invalid input'   400 { Post '/auth/register' '{"name":"","email":"bad","password":"1"}' }
Check 'login: wrong password'     401 { Post '/auth/login' '{"email":"admin@example.com","password":"nope"}' }
Check 'login: unknown email'      401 { Post '/auth/login' '{"email":"nobody@example.com","password":"x"}' }
Check 'refresh: fake token'       401 { Post '/auth/refresh' '{"refreshToken":"fake"}' }

Write-Host "`n--- requireAuth ---"
Check 'me: no token'              401 { Get '/auth/me' }
Check 'me: tampered token'        401 { Get '/auth/me' $badH }
Check 'me: valid token'           200 { Get '/auth/me' $custH }

Write-Host "`n--- requireRole ---"
Check 'admin stats: no token'     401 { Get '/admin/stats' }
Check 'admin stats: customer'     403 { Get '/admin/stats' $custH }
Check 'admin stats: admin'        200 { Get '/admin/stats' $adminH }

Write-Host "`n--- Bad requests ---"
Check 'user id: abc'              400 { Get '/admin/users/abc' $adminH }
Check 'user id: negative'         400 { Get '/admin/users/-5' $adminH }
Check 'user id: not found'        404 { Get '/admin/users/99999' $adminH }
Check 'user id: valid'            200 { Get '/admin/users/2' $adminH }
Check 'malformed JSON'            400 { Post '/auth/login' '{"email": "a@b.com",' }
Check 'body too large'            413 { Post '/auth/login' (@{ email = 'a@b.com'; password = ('x' * 2MB) } | ConvertTo-Json) }




Write-Host "`n--- Products: browse ---"
Check 'list: defaults'              200 { Get '/products' }
Check 'list: filters + search'      200 { Get '/products?category=books&minPrice=10&maxPrice=500&inStock=true&sort=price_asc&q=a' }
Check 'list: limit too big'         400 { Get '/products?limit=500' }
Check 'list: bad sort'              400 { Get '/products?sort=random' }
Check 'list: minPrice > maxPrice'   400 { Get '/products?minPrice=500&maxPrice=100' }
Check 'get: valid id'               200 { Get '/products/1' }
Check 'get: invalid id'             400 { Get '/products/abc' }
Check 'get: not found'              404 { Get '/products/99999' }

Write-Host "`n--- Products: admin ---"
$lamp = '{"name":"Smoke Test Lamp","price":19.99,"stock":5,"categoryId":4}'
Check 'create: no token'            401 { Post '/products' $lamp }
Check 'create: customer'            403 { Post '/products' $lamp $custH }
Check 'create: bad price'           400 { Post '/products' '{"name":"X","price":-5,"categoryId":4}' $adminH }
Check 'create: admin'               201 { $script:created = Post '/products' $lamp $adminH; $script:created }
$prodId = ($created.Content | ConvertFrom-Json).product.id

Check 'update: price'               200 { Patch "/products/$prodId" '{"price":9.99}' $adminH }
Check 'update: empty body'          400 { Patch "/products/$prodId" '{}' $adminH }
Check 'delete: customer'            403 { DeleteRequest "/products/$prodId" $custH }
Check 'delete: admin'               204 { DeleteRequest "/products/$prodId" $adminH }
Check 'get: deleted is hidden'      404 { Get "/products/$prodId" }
Check 'api docs page'             200 { Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4000/api-docs/' }
Check 'api docs json'             200 { Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4000/api-docs.json' }

Write-Host "`n$pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })