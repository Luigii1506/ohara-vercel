import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError, validateListAccess } from '@/lib/auth-helpers';

/**
 * GET /api/lists/[id] - Obtener lista específica con sus cartas
 * Versión refactorizada con validación de acceso mejorada
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Autenticación centralizada
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'ID de lista inválido' }, { status: 400 });
    }

    // Validar acceso a la lista
    const { hasAccess, isOwner, list } = await validateListAccess(listId, user.id);
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
    }

    // Obtener parámetros de consulta para paginación y filtros
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';

    // Construir filtros para las cartas
    const cardFilters: any = { listId };
    
    if (search) {
      cardFilters.card = {
        name: {
          contains: search,
          mode: 'insensitive'
        }
      };
    }

    // Obtener cartas con paginación
    const offset = (page - 1) * limit;
    
    const cards = await prisma.userListCard.findMany({
      where: cardFilters,
      include: {
        card: {
          include: {
            colors: true,
            types: true,
            sets: {
              include: {
                set: true
              }
            }
          }
        }
      },
      orderBy: list!.isOrdered 
        ? [
            { page: 'asc' },
            { row: 'asc' },
            { column: 'asc' }
          ]
        : [
            { sortOrder: 'asc' },
            { createdAt: 'asc' }
          ],
      skip: offset,
      take: limit
    });

    // Contar total de cartas para paginación
    const totalCards = await prisma.userListCard.count({
      where: cardFilters
    });

    const totalPages = Math.ceil(totalCards / limit);

    return NextResponse.json({
      list: {
        ...list,
        // Solo mostrar email del dueño si es público y no es el dueño
        user: isOwner ? list!.user : { name: list!.user.name }
      },
      cards,
      pagination: {
        currentPage: page,
        totalPages,
        totalCards,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      isOwner
    });

  } catch (error) {
    console.error('Error al obtener lista:', error);
    return handleAuthError(error);
  }
}

/**
 * PUT /api/lists/[id] - Actualizar lista
 * Solo el propietario puede actualizar
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'ID de lista inválido' }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      description,
      isOrdered,
      maxRows,
      maxColumns,
      color,
      isPublic
    } = body;

    // Verificar que la lista existe y el usuario es el dueño
    const existingList = await prisma.userList.findFirst({
      where: {
        id: listId,
        userId: user.id
      }
    });

    if (!existingList) {
      return NextResponse.json({ 
        error: 'Lista no encontrada o sin permisos' 
      }, { status: 404 });
    }

    // Validaciones para nombre si se está cambiando
    if (name && name !== existingList.name) {
      if (name.toLowerCase() === 'colección' && !existingList.isCollection) {
        return NextResponse.json({ 
          error: 'No se puede cambiar el nombre a "Colección"' 
        }, { status: 400 });
      }

      // Verificar que no exista otra lista con el mismo nombre
      const duplicateList = await prisma.userList.findFirst({
        where: {
          userId: user.id,
          name: name.trim(),
          id: { not: listId }
        }
      });

      if (duplicateList) {
        return NextResponse.json({ 
          error: 'Ya existe una lista con ese nombre' 
        }, { status: 400 });
      }
    }

    // Preparar datos de actualización
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (color !== undefined) updateData.color = color || null;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    // Solo permitir cambiar isOrdered si la lista está vacía
    if (isOrdered !== undefined && isOrdered !== existingList.isOrdered) {
      const cardCount = await prisma.userListCard.count({
        where: { listId }
      });

      if (cardCount > 0) {
        return NextResponse.json({ 
          error: 'No se puede cambiar el tipo de lista cuando tiene cartas' 
        }, { status: 400 });
      }

      updateData.isOrdered = isOrdered;
      
      if (isOrdered) {
        if (!maxRows || !maxColumns || maxRows < 1 || maxColumns < 1) {
          return NextResponse.json({ 
            error: 'Para listas ordenadas se requieren maxRows y maxColumns válidos' 
          }, { status: 400 });
        }
        updateData.maxRows = maxRows;
        updateData.maxColumns = maxColumns;
      } else {
        updateData.maxRows = null;
        updateData.maxColumns = null;
      }
    }

    // Actualizar la lista
    const updatedList = await prisma.userList.update({
      where: { id: listId },
      data: updateData,
      include: {
        _count: {
          select: { cards: true }
        }
      }
    });

    return NextResponse.json({ 
      message: 'Lista actualizada exitosamente',
      list: updatedList 
    });

  } catch (error) {
    console.error('Error al actualizar lista:', error);
    return handleAuthError(error);
  }
}

/**
 * DELETE /api/lists/[id] - Eliminar lista
 * Solo el propietario puede eliminar listas eliminables
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'ID de lista inválido' }, { status: 400 });
    }

    // Verificar que la lista existe, el usuario es el dueño y es eliminable
    const list = await prisma.userList.findFirst({
      where: {
        id: listId,
        userId: user.id
      }
    });

    if (!list) {
      return NextResponse.json({ 
        error: 'Lista no encontrada o sin permisos' 
      }, { status: 404 });
    }

    if (!list.isDeletable) {
      return NextResponse.json({ 
        error: 'Esta lista no se puede eliminar' 
      }, { status: 400 });
    }

    // Eliminar la lista (las cartas se eliminarán automáticamente por CASCADE)
    await prisma.userList.delete({
      where: { id: listId }
    });

    return NextResponse.json({ 
      message: 'Lista eliminada exitosamente' 
    });

  } catch (error) {
    console.error('Error al eliminar lista:', error);
    return handleAuthError(error);
  }
}