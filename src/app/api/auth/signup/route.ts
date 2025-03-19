import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AppError } from '@/lib/utils/errorHandling';
import AppLogger from '@/lib/utils/logger';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      throw new AppError('Missing required fields');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('User already exists');
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    AppLogger.info('User created successfully', {
      component: 'SignupAPI',
      action: 'POST',
      userId: user.id,
      email: user.email
    });

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    AppLogger.error('Failed to create user', error as Error, {
      component: 'SignupAPI',
      action: 'POST',
      path: '/api/auth/signup'
    });

    if (error instanceof AppError) {
      const statusCode = error.message.includes('already exists') ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 