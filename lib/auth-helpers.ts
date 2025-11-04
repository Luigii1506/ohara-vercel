import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { authOptions } from './auth-config';

/**
 * Resultado de autenticación
 */
export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  status?: number;
}

/**
 * Obtiene el usuario autenticado de la sesión
 * @returns Promise<AuthResult>
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'No autorizado',
        status: 401
      };
    }

    // Buscar usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return {
        success: false,
        error: 'Usuario no encontrado',
        status: 404
      };
    }

    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Error en getAuthenticatedUser:', error);
    return {
      success: false,
      error: 'Error interno del servidor',
      status: 500
    };
  }
}

/**
 * Middleware de autenticación que requiere usuario válido
 * Lanza error si no está autenticado
 * @returns Promise<User>
 */
export async function requireAuth() {
  const result = await getAuthenticatedUser();
  
  if (!result.success) {
    throw new AuthError(result.error!, result.status!);
  }
  
  return result.user!;
}

/**
 * Clase personalizada para errores de autenticación
 */
export class AuthError extends Error {
  public status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Maneja errores de autenticación y devuelve respuesta JSON apropiada
 * @param error - Error capturado
 * @returns NextResponse con error formateado
 */
export function handleAuthError(error: any): NextResponse {
  console.error('Error de autenticación:', error);
  
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }
  
  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 }
  );
}

/**
 * Wrapper para rutas API que maneja automáticamente la autenticación
 * @param handler - Función handler que recibe el usuario autenticado
 * @returns Función de ruta API
 */
export function withAuth<T extends any[]>(
  handler: (user: any, ...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const user = await requireAuth();
      return await handler(user, ...args);
    } catch (error) {
      return handleAuthError(error);
    }
  };
}

/**
 * Valida que un usuario sea propietario de una lista
 * @param listId - ID de la lista
 * @param userId - ID del usuario
 * @returns Promise<boolean>
 */
export async function validateListOwnership(listId: number, userId: number): Promise<boolean> {
  const list = await prisma.userList.findFirst({
    where: {
      id: listId,
      userId: userId
    }
  });
  
  return !!list;
}

/**
 * Valida que un usuario tenga acceso a una lista (propietario o pública)
 * @param listId - ID de la lista
 * @param userId - ID del usuario
 * @returns Promise<{hasAccess: boolean, isOwner: boolean, list?: any}>
 */
export async function validateListAccess(listId: number, userId: number) {
  const list = await prisma.userList.findFirst({
    where: {
      id: listId,
      OR: [
        { userId: userId }, // Es propietario
        { isPublic: true }  // Es pública
      ]
    },
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  });
  
  if (!list) {
    return { hasAccess: false, isOwner: false };
  }
  
  return {
    hasAccess: true,
    isOwner: list.userId === userId,
    list
  };
}