import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Project Hub <onboarding@resend.dev>';

    if (!supabaseUrl) {
      console.error('Missing Supabase URL environment variable. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in Vercel.');
      return NextResponse.json(
        { error: 'Server authentication configuration is incomplete. Please check the Supabase URL environment variable.' },
        { status: 500 }
      );
    }

    // If configuration is missing on server, log details for debugging in Vercel
    if (!serviceRoleKey) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
      return NextResponse.json(
        { error: 'Server authentication configuration is incomplete. Please check SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
        { status: 500 }
      );
    }

    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY environment variable.');
      return NextResponse.json(
        { error: 'Email service configuration is incomplete. Please check RESEND_API_KEY in Vercel.' },
        { status: 500 }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate password recovery link without sending Supabase's built-in email
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${siteUrl}/reset-password.html`,
      },
    });

    if (linkError) {
      console.error('Supabase generateLink error:', linkError.message);
      // If user is not found, return success anyway to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.',
      });
    }

    const resetLink = linkData?.properties?.action_link || `${siteUrl}/reset-password.html?token_hash=${linkData?.properties?.hashed_token}&type=recovery`;

    // Construct email HTML template
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f8fa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #14212b;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f8fa;
      padding: 40px 16px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 40px 32px;
      border: 1px solid #d9e2e7;
      box-shadow: 0 4px 16px rgba(25, 52, 67, 0.06);
    }
    .brand {
      font-size: 16px;
      font-weight: 700;
      color: #117aa3;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #14212b;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #485761;
      margin: 0 0 20px 0;
    }
    .btn-container {
      margin: 28px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #117aa3;
      color: #ffffff !important;
      text-decoration: none;
      padding: 13px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
    }
    .fallback {
      font-size: 13px;
      color: #6b7b86;
      word-break: break-all;
      line-height: 1.5;
      margin-top: 24px;
      border-top: 1px solid #edf2f5;
      padding-top: 20px;
    }
    .footer {
      margin-top: 28px;
      font-size: 12px;
      color: #8b99a3;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand">Project Hub</div>
      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your Project Hub account associated with <strong>${email}</strong>.</p>
      <p>Click the button below to choose a new password:</p>
      <div class="btn-container">
        <a href="${resetLink}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
      </div>
      <p>This password reset link will expire in 24 hours. If you did not make this request, you can safely ignore this email.</p>
      <div class="fallback">
        If the button above does not work, copy and paste this URL into your browser:<br>
        <a href="${resetLink}" style="color: #117aa3;">${resetLink}</a>
      </div>
    </div>
    <div class="footer">
      &copy; Project Hub. All rights reserved.<br>
      Automated account notification &bull; Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
    `;

    // Send the email via Resend REST API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Reset your Project Hub password',
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return NextResponse.json(
        { error: resendData.message || 'Failed to send reset email via Resend.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent successfully.',
    });
  } catch (err: any) {
    console.error('send-reset error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
