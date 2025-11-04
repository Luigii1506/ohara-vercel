import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuth, requireAuth, handleAuthError } from '@/lib/auth-helpers';

/**
 * GET /api/lists - Obtener todas las listas del usuario
 * Versión refactorizada usando el sistema de autenticación centralizado
 */
export const GET = withAuth(async (user: any, request: NextRequest) => {
  try {
    // Obtener todas las listas del usuario con estadísticas básicas
    const lists = await prisma.userList.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { cards: true }
        }
      },
      orderBy: [
        { isCollection: 'desc' }, // Colección primero
        { createdAt: 'asc' }
      ]
    });

    return NextResponse.json({ lists });
  } catch (error) {
    console.error('Error al obtener listas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/lists - Crear nueva lista
 * Versión refactorizada usando el sistema de autenticación centralizado
 */
export const POST = withAuth(async (user: any, request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      name,
      description,
      isOrdered = false,
      maxRows,
      maxColumns,
      color,
      isPublic = false
    } = body;

    // Validaciones básicas
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (name.toLowerCase() === 'colección') {
      return NextResponse.json({ 
        error: 'No se puede crear una lista con el nombre "Colección"' 
      }, { status: 400 });
    }

    // Verificar que no exista una lista con el mismo nombre
    const existingList = await prisma.userList.findFirst({
      where: {
        userId: user.id,
        name: name.trim()
      }
    });

    if (existingList) {
      return NextResponse.json({ 
        error: 'Ya existe una lista con ese nombre' 
      }, { status: 400 });
    }

    // Validaciones para listas ordenadas
    if (isOrdered) {
      if (!maxRows || !maxColumns || maxRows < 1 || maxColumns < 1) {
        return NextResponse.json({ 
          error: 'Para listas ordenadas se requieren maxRows y maxColumns válidos' 
        }, { status: 400 });
      }
      
      if (maxRows > 10 || maxColumns > 10) {
        return NextResponse.json({ 
          error: 'Máximo 10 filas y 10 columnas permitidas' 
        }, { status: 400 });
      }
    }

    // Crear la lista
    const newList = await prisma.userList.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        isOrdered,
        maxRows: isOrdered ? maxRows : null,
        maxColumns: isOrdered ? maxColumns : null,
        totalPages: 1,
        color: color || null,
        isPublic,
        isDeletable: true,
        isCollection: false
      },
      include: {
        _count: {
          select: { cards: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Lista creada exitosamente',
      list: newList 
    }, { status: 201 });

  } catch (error) {
    console.error('Error al crear lista:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
});