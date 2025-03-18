import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import prisma from '@/lib/prisma';
import { NotificationType } from '@/types/notification';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, type, options } = body;

    // Input validation
    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!type || !Object.values(NotificationType).includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      );
    }

    // If userId is provided, verify user exists
    if (options?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: options.userId }
      });
      
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }

    // Process channels
    const channels = options?.channel || ['database'];
    const results: Record<string, boolean> = { database: true };

    // Send email if requested and user exists
    if (channels.includes('email') && options?.userId) {
      const emailSent = await sendEmail({
        to: options.userId,
        subject: `${type.toUpperCase()}: ${message.substring(0, 50)}...`,
        text: message,
        html: `<div style="padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
          <h2 style="color: ${type === NotificationType.ERROR ? '#dc3545' : 
                      type === NotificationType.WARNING ? '#ffc107' : 
                      type === NotificationType.SUCCESS ? '#28a745' : '#17a2b8'}">
            ${type.toUpperCase()}
          </h2>
          <p style="color: #333;">${message}</p>
        </div>`
      });
      results.email = emailSent;
    }

    // Store notification in database
    const notification = await prisma.notification.create({
      data: {
        message,
        type,
        userId: options?.userId || null, // Explicitly set null if no userId
        priority: options?.priority || 'medium',
        status: Object.values(results).every(result => result) ? 'delivered' : 'partial',
        metadata: {
          deliveryResults: results,
          ...options?.metadata
        }
      }
    });

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        status: notification.status,
        channels: results,
        createdAt: notification.createdAt
      }
    });
  } catch (error) {
    console.error('Notification API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 