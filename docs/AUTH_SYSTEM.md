# Sistema de Autenticación Centralizado

## 📋 Descripción

Este sistema elimina la duplicación de código de autenticación en las rutas API, proporcionando una solución profesional y mantenible.

## 🏗️ Arquitectura

### Archivos Principales

- **`lib/auth-config.ts`** - Configuración centralizada de NextAuth
- **`lib/auth-helpers.ts`** - Funciones helper y middleware de autenticación

### Antes vs Después

#### ❌ Antes (Código Duplicado)
```typescript
// En cada archivo de ruta API (25+ líneas repetidas)
const authOptions = {
  providers: [],
  session: { strategy: 'jwt' as const },
  callbacks: {
    async session({ session, token }: any) {
      if (session?.user && token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ user, token }: any) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
};

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  // ... 20+ líneas más
}
```

#### ✅ Después (Sistema Centralizado)
```typescript
import { requireAuth, handleAuthError } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(); // 1 línea!
    // ... lógica de negocio
  } catch (error) {
    return handleAuthError(error); // 1 línea!
  }
}
```

## 🚀 Uso

### Método 1: Wrapper Automático (Recomendado)
```typescript
import { withAuth } from '@/lib/auth-helpers';

export const GET = withAuth(async (user, request: NextRequest) => {
  // El usuario ya está autenticado automáticamente
  // Manejo de errores automático
  
  const lists = await prisma.userList.findMany({
    where: { userId: user.id }
  });
  
  return NextResponse.json({ lists });
});
```

### Método 2: Manual (Mayor Control)
```typescript
import { requireAuth, handleAuthError } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Tu lógica aquí
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

## 🛠️ Funciones Disponibles

### `requireAuth()`
- **Descripción**: Obtiene el usuario autenticado o lanza error
- **Retorna**: `User` object
- **Lanza**: `AuthError` si no está autenticado

### `withAuth(handler)`
- **Descripción**: Wrapper que maneja autenticación automáticamente
- **Parámetros**: Función handler que recibe (user, ...args)
- **Retorna**: Función de ruta API

### `handleAuthError(error)`
- **Descripción**: Convierte errores de auth en respuestas JSON
- **Retorna**: `NextResponse` con error formateado

### `validateListAccess(listId, userId)`
- **Descripción**: Valida acceso a listas (propietario o pública)
- **Retorna**: `{hasAccess, isOwner, list}`

## 📊 Beneficios

### ✅ Eliminación de Duplicación
- **Antes**: 25+ líneas repetidas en cada archivo
- **Después**: 1-3 líneas de código

### ✅ Consistencia
- Manejo de errores estandarizado
- Validaciones centralizadas
- Tipado fuerte con TypeScript

### ✅ Mantenibilidad
- Un solo lugar para cambios de autenticación
- Fácil testing y debugging
- Código más limpio y legible

## 🔄 Migración

Reemplaza el código duplicado en tus rutas:

```typescript
// Cambiar esto:
const session = await getServerSession(authOptions);
if (!session?.user?.email) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
});

// Por esto:
const user = await requireAuth();
```

## 🔐 Recuperación de contraseña

El sistema soporta restablecimiento de contraseñas sin exponer datos sensibles:

- `POST /api/auth/forgot-password`: genera un token efímero y envía un correo con el enlace (`/reset-password?token=...`). Responde exitosamente aunque el correo no exista, para evitar enumeración.
- `POST /api/auth/reset-password`: valida el token, actualiza la contraseña (bcrypt) y marca el token como usado. Invalidamos cualquier token pendiente del mismo usuario.
- Componentes UI disponibles en `/forgot-password` y `/reset-password`.
- Los usuarios que se autentican con Google pueden añadir una contraseña en `/account/settings` o registrarse de nuevo con el mismo correo: si la cuenta no tenía `password`, se activa sin perder datos.

### Configuración de correo

Define `RESEND_API_KEY` y `EMAIL_FROM` (p.ej. `Ohara TCG <no-reply@oharatcg.com>`) para habilitar el envío real. Si no hay API key, el sistema loguea el contenido en consola para facilitar el desarrollo.
