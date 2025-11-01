# Seller Feature Documentation

## Overview

The seller feature allows users with the SELLER role to create and manage card listings through integration with the Laravel backend API.

## Environment Variables

Add the following variables to your `.env.local` file:

```env
# Laravel Backend API
# Ya no se necesita - ahora usa rutas locales de Next.js
# NEXT_PUBLIC_API_URL=/api
```

## Authentication Headers

The API client automatically includes the following headers in all requests:

- `x-api-client`: Client identifier for API access
- `Authorization`: Bearer token (after successful authentication)
- `Content-Type`: application/json (except for file uploads)
- `Accept`: application/json

## Authentication Flow

1. Users authenticate through NextAuth in the Next.js frontend
2. Call `/auth/token` endpoint with email and password to get Laravel token
3. Token is stored in localStorage as `laravel_token`
4. All subsequent API calls include the Bearer token automatically

### Login Example

```javascript
// Login to Laravel backend
const { token, user } = await apiClient.login(email, password);
// Token is automatically stored and used for future requests
```

## Features

### Dashboard (`/seller`)

- View all listings with stats
- Filter by status (active, inactive, sold)
- Quick actions for edit/delete
- Pagination support

### Create Listing (`/seller/listings/new`)

- Basic information (title, description)
- Pricing and quantity
- Card condition and language
- Image upload
- Status management

### Edit Listing (`/seller/listings/[id]`)

- Update all listing details
- Manage listing items
- Add/remove specific cards
- Update images

## API Integration

The seller features use the following API endpoints:

- `GET /seller/listings` - Get seller's listings
- `POST /seller/listings` - Create new listing
- `PUT /seller/listings/{id}` - Update listing
- `DELETE /seller/listings/{id}` - Delete listing
- `POST /seller/listings/{id}/image` - Upload listing image
- `POST /seller/listings/{id}/items` - Add item to listing
- `PUT /seller/listings/{id}/items/{itemId}` - Update item
- `DELETE /seller/listings/{id}/items/{itemId}` - Remove item

## User Synchronization

The system uses UUID to sync users between databases:

1. Next.js (Prisma) - Local user data with UUID
2. Laravel - External user data matched by UUID

Ensure both systems have the same UUID for each user to maintain consistency.

## Permissions

Only users with role `SELLER` can access these features. The middleware checks:

1. User is authenticated
2. User has SELLER role
3. Valid Laravel API token exists

## Development Notes

### Testing with Local Laravel

If testing with a local Laravel instance, update the API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### CORS Configuration

Ensure the Laravel backend has proper CORS settings to accept requests from your Next.js domain. The backend should allow:

- Origin: Your Next.js domain
- Headers: x-api-client, Authorization, Content-Type, Accept
- Methods: GET, POST, PUT, DELETE

### Error Handling

All API errors are caught and displayed using toast notifications. Check the browser console for detailed error messages during development.
