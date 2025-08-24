import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private useSendGrid: boolean;
  private fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('app.email.from', 'noreply@comm-service.local');
    this.initializeEmailProvider();
  }

  private initializeEmailProvider() {
    const sendGridApiKey = this.configService.get<string>('app.email.sendgrid.apiKey');
    
    if (sendGridApiKey) {
      // Use SendGrid
      sgMail.setApiKey(sendGridApiKey);
      this.useSendGrid = true;
      this.logger.log('Email service initialized with SendGrid');
    } else {
      // Use SMTP
      const smtpConfig = this.configService.get('app.email.smtp');
      
      if (smtpConfig.user && smtpConfig.pass) {
        this.transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.port === 465,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        });
        
        this.useSendGrid = false;
        this.logger.log('Email service initialized with SMTP');
      } else {
        this.logger.warn('Email service not configured properly');
      }
    }
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
    try {
      if (this.useSendGrid) {
        await this.sendViaSendGrid(to, subject, text, html);
      } else if (this.transporter) {
        await this.sendViaSMTP(to, subject, text, html);
      } else {
        throw new Error('Email service not configured');
      }
      
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  private async sendViaSendGrid(to: string, subject: string, text: string, html?: string): Promise<void> {
    const msg = {
      to,
      from: this.fromEmail,
      subject,
      text,
      html: html || this.textToHtml(text),
    };

    await sgMail.send(msg);
  }

  private async sendViaSMTP(to: string, subject: string, text: string, html?: string): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to,
      subject,
      text,
      html: html || this.textToHtml(text),
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendEmailWithConfirmation(
    to: string,
    subject: string,
    text: string,
    confirmationLink: string,
  ): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .content {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .confirm-button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          .reject-button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #f44336;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-left: 10px;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
          }
          pre {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Confirmation Required</h2>
          </div>
          <div class="content">
            ${this.textToHtml(text)}
          </div>
          <div class="button-container">
            <a href="${confirmationLink}&action=confirm" class="confirm-button">✓ Confirm</a>
            <a href="${confirmationLink}&action=reject" class="reject-button">✗ Reject</a>
          </div>
          <div class="footer">
            <p>This link will expire in 5 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>© 2025 Comm Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(to, subject, text, htmlContent);
  }

  async sendOTP(to: string, otp: string, purpose: string, ttlMinutes: number = 10): Promise<void> {
    const subject = `Your verification code for ${purpose}`;
    const text = `Your verification code is: ${otp}\n\nThis code will expire in ${ttlMinutes} minutes.`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .otp-container {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
            margin: 20px 0;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
            letter-spacing: 8px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Verification Code</h2>
            <p>Use this code to complete your ${purpose}</p>
          </div>
          <div class="otp-container">
            <p>Your verification code is:</p>
            <div class="otp-code">${otp}</div>
            <p>This code will expire in ${ttlMinutes} minutes.</p>
          </div>
          <div class="footer">
            <p>If you didn't request this code, please ignore this email.</p>
            <p>© 2025 Comm Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(to, subject, text, htmlContent);
  }

  async sendMagicLink(to: string, magicLink: string, purpose: string, ttlMinutes: number = 10): Promise<void> {
    const subject = `Magic link for ${purpose}`;
    const text = `Click the following link to ${purpose}:\n\n${magicLink}\n\nThis link will expire in ${ttlMinutes} minutes.`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .link-container {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
            margin: 20px 0;
          }
          .magic-link {
            display: inline-block;
            padding: 12px 30px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Magic Link</h2>
            <p>Click the button below to ${purpose}</p>
          </div>
          <div class="link-container">
            <p>This link will expire in ${ttlMinutes} minutes.</p>
            <a href="${magicLink}" class="magic-link">Continue →</a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              Or copy this link:<br>
              <code style="background: #f4f4f4; padding: 5px; border-radius: 3px; font-size: 11px;">
                ${magicLink}
              </code>
            </p>
          </div>
          <div class="footer">
            <p>If you didn't request this link, please ignore this email.</p>
            <p>© 2025 Comm Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(to, subject, text, htmlContent);
  }

  private textToHtml(text: string): string {
    // Convert plain text to HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    // Wrap in paragraphs
    html = `<p>${html}</p>`;
    
    // Convert markdown-style bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown-style italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert markdown-style code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    return html;
  }
}