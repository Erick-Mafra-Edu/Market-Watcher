/**
 * SMTP Email Provider
 * Supports both HTML and plain text emails
 */
import nodemailer, { Transporter } from 'nodemailer';
import {
  BaseMessagingProvider,
  MessageContent,
  MessageRecipient,
  MessageResult,
  MessageFormat,
} from './base';

export interface SMTPConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class SMTPProvider extends BaseMessagingProvider {
  private transporter: Transporter;
  private config: SMTPConfig;

  constructor(config: SMTPConfig) {
    super('SMTP');
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure || false,
      auth: config.auth,
    });
  }

  async send(
    recipient: MessageRecipient,
    content: MessageContent
  ): Promise<MessageResult> {
    try {
      if (!this.canSendTo(recipient)) {
        return {
          success: false,
          error: 'Recipient does not have an email address',
          provider: this.name,
        };
      }

      const mailOptions: any = {
        from: this.config.from,
        to: recipient.email,
        subject: content.subject || 'Market Watcher Alert',
      };

      // Support both HTML and text
      if (content.format === MessageFormat.HTML) {
        mailOptions.html = content.body;
        mailOptions.text = this.htmlToText(content.body); // Fallback
      } else {
        mailOptions.text = content.body;
      }

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        provider: this.name,
      };
    } catch (error: any) {
      console.error('SMTP send error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name,
      };
    }
  }

  supportsFormat(format: MessageFormat): boolean {
    // SMTP supports both HTML and TEXT
    return true;
  }

  canSendTo(recipient: MessageRecipient): boolean {
    return !!recipient.email;
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP provider ready');
      return true;
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return false;
    }
  }
}
