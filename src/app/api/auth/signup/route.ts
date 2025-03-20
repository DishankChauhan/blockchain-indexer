import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { logError, logInfo } from '@/lib/utils/serverLogger';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return new NextResponse('User already exists', { status: 409 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    logInfo('User created successfully', {
      component: 'SignupAPI',
      action: 'POST',
      userId: user.id
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    logError('Failed to create user', error as Error, {
      component: 'SignupAPI',
      action: 'POST'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 