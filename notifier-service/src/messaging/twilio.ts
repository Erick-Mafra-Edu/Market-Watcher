/**
 * Twilio SMS Provider
 * Supports plain text SMS messages
 */
import twilio from 'twilio';
import {
  BaseMessagingProvider,
  MessageContent,
  MessageRecipient,
  MessageResult,
  MessageFormat,
} from './base';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioProvider extends BaseMessagingProvider {
  private client: twilio.Twilio;
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    super('Twilio');
    this.config = config;
    this.client = twilio(config.accountSid, config.authToken);
  }

  async send(
    recipient: MessageRecipient,
    content: MessageContent
  ): Promise<MessageResult> {
    try {
      if (!this.canSendTo(recipient)) {
        return {
          success: false,
          error: 'Recipient does not have a phone number',
          provider: this.name,
        };
      }

      // Prepare text content (convert HTML if needed)
      const textContent = this.prepareContent(content);

      // Add subject to message if present
      const messageBody = content.subject
        ? `${content.subject}\n\n${textContent}`
        : textContent;

      const message = await this.client.messages.create({
        body: messageBody,
        from: this.config.fromNumber,
        to: recipient.phone!,
      });

      return {
        success: true,
        messageId: message.sid,
        provider: this.name,
      };
    } catch (error: any) {
      console.error('Twilio send error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name,
      };
    }
  }

  supportsFormat(format: MessageFormat): boolean {
    // Twilio SMS only supports plain text
    return format === MessageFormat.TEXT;
  }

  canSendTo(recipient: MessageRecipient): boolean {
    return !!recipient.phone;
  }
}
