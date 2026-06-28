# Local Kart

Local Kart is a hyperlocal marketplace web project with a connected frontend and backend.

## Run The Project

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Included Modules

- Customer shop discovery
- Product catalog
- Cart and checkout
- Order tracking
- Vendor dashboard
- Delivery partner dashboard
- Admin dashboard
- Demo authentication routes

## Backend API Routes

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/shops
GET  /api/products
GET  /api/cart
POST /api/cart
PATCH /api/cart/:productId
POST /api/orders
GET  /api/orders/latest
PATCH /api/orders/:orderId/status
GET  /api/dashboard
```

## Notes

This version uses a dependency-free Node.js backend and in-memory data. It is ready for demonstration and can later be upgraded to Express.js and MongoDB.
