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
Write-Host "`n--- Cart ---"
Check 'cart: no token'              401 { Get '/cart' }
Check 'cart: clear'                 200 { DeleteRequest '/cart' $custH }
Check 'cart: view empty'            200 { Get '/cart' $custH }
Check 'cart: add item'              200 { Post '/cart/items' '{"productId":1,"quantity":1}' $custH }
Check 'cart: add same again'        200 { Post '/cart/items' '{"productId":1}' $custH }
Check 'cart: add over 99'           400 { Post '/cart/items' '{"productId":1,"quantity":99}' $custH }
Check 'cart: add unknown product'   404 { Post '/cart/items' '{"productId":99999}' $custH }
Check 'cart: add invalid id'        400 { Post '/cart/items' '{"productId":"abc"}' $custH }
Check 'cart: set quantity'          200 { Patch '/cart/items/1' '{"quantity":1}' $custH }
Check 'cart: set above stock'       409 { Patch '/cart/items/1' '{"quantity":99}' $custH }
Check 'cart: set zero'              400 { Patch '/cart/items/1' '{"quantity":0}' $custH }
Check 'cart: set not in cart'       404 { Patch '/cart/items/2' '{"quantity":1}' $custH }
Check 'cart: remove item'           200 { DeleteRequest '/cart/items/1' $custH }
Check 'cart: remove again'          404 { DeleteRequest '/cart/items/1' $custH }
Write-Host "`n--- Orders ---"
Check 'orders: no token'             401 { Get '/orders' }
Check 'orders: list'                 200 { Get '/orders' $custH }
Check 'checkout: empty cart'         400 { DeleteRequest '/cart' $custH | Out-Null; Post '/orders' '{"shipping":{"name":"T","line1":"1 St","city":"Kandy","postalCode":"20000","country":"LK"}}' $custH }
Check 'checkout: missing address'    400 { Post '/orders' '{"shipping":{"name":"T"}}' $custH }
Check 'checkout: success'            201 { Post '/cart/items' '{"productId":10,"quantity":1}' $custH | Out-Null; $script:order = Post '/orders' '{"shipping":{"name":"T","line1":"1 St","city":"Kandy","postalCode":"20000","country":"LK"}}' $custH; $script:order }
$orderId = ($order.Content | ConvertFrom-Json).order.id
Check 'order: get own'               200 { Get "/orders/$orderId" $custH }
Check 'order: other user (admin)'    404 { Get "/orders/$orderId" $adminH }
Check 'order: invalid id'            400 { Get '/orders/abc' $custH }
Check 'order: not found'             404 { Get '/orders/99999999' $custH }
Write-Host "`n--- Order lifecycle ---"
$ship = '{"shipping":{"name":"T","line1":"1 St","city":"Kandy","postalCode":"20000","country":"LK"}}'
function NewOrderId {
  DeleteRequest '/cart' $custH | Out-Null
  Post '/cart/items' '{"productId":10,"quantity":1}' $custH | Out-Null
  ((Post '/orders' $ship $custH).Content | ConvertFrom-Json).order.id
}

$o1 = NewOrderId
Check 'pay: declined card'           402 { Post "/orders/$o1/pay" '{"cardNumber":"4000000000000002"}' $custH }
Check 'pay: invalid card'            400 { Post "/orders/$o1/pay" '{"cardNumber":"1234"}' $custH }
Check 'pay: success'                 200 { Post "/orders/$o1/pay" '{"cardNumber":"4242424242424242"}' $custH }
Check 'pay: already paid'            409 { Post "/orders/$o1/pay" '{"cardNumber":"4242424242424242"}' $custH }
Check 'cancel: paid (refund)'        200 { Post "/orders/$o1/cancel" '{}' $custH }
Check 'cancel: already cancelled'    409 { Post "/orders/$o1/cancel" '{}' $custH }

$o2 = NewOrderId
Check 'admin ship: unpaid'           409 { Patch "/admin/orders/$o2/status" '{"status":"shipped"}' $adminH }
Post "/orders/$o2/pay" '{"cardNumber":"4242424242424242"}' $custH | Out-Null
Check 'admin ship: as customer'      403 { Patch "/admin/orders/$o2/status" '{"status":"shipped"}' $custH }
Check 'admin ship: bad status'       400 { Patch "/admin/orders/$o2/status" '{"status":"cancelled"}' $adminH }
Check 'admin ship: paid order'       200 { Patch "/admin/orders/$o2/status" '{"status":"shipped"}' $adminH }
Check 'admin deliver'                200 { Patch "/admin/orders/$o2/status" '{"status":"delivered"}' $adminH }
Check 'cancel: delivered'            409 { Post "/orders/$o2/cancel" '{}' $custH }

Check 'admin orders: list'           200 { Get '/admin/orders' $adminH }
Check 'admin orders: filter'         200 { Get '/admin/orders?status=delivered' $adminH }
Check 'admin orders: bad filter'     400 { Get '/admin/orders?status=lost' $adminH }
Check 'categories: list'            200 { Get '/categories' }

Write-Host "`n$pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })