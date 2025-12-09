/**
 * WhatsApp Provider using utter-labs/wa-bot-api
 * Supports plain text messages via WhatsApp
 */
import axios, { AxiosInstance } from 'axios';
import {
  BaseMessagingProvider,
  MessageContent,
  MessageRecipient,
  MessageResult,
  MessageFormat,
} from './base';

export interface WhatsAppConfig {
  apiUrl: string;
  apiKey?: string;
  instanceId: string;
}

export class WhatsAppProvider extends BaseMessagingProvider {
  private client: AxiosInstance;
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    super('WhatsApp');
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      },
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
          error: 'Recipient does not have a WhatsApp number',
          provider: this.name,
        };
      }

      // Prepare text content (convert HTML if needed)
      const textContent = this.prepareContent(content);

      // Format message with subject if present
      const messageBody = content.subject
        ? `*${content.subject}*\n\n${textContent}`
        : textContent;

      // Format WhatsApp number (remove special characters)
      const formattedNumber = this.formatWhatsAppNumber(recipient.whatsapp!);

      // Send message via utter-labs/wa-bot-api
      const response = await this.client.post('/send-message', {
        instanceId: this.config.instanceId,
        to: formattedNumber,
        message: messageBody,
      });

      return {
        success: true,
        messageId: response.data.messageId || response.data.id,
        provider: this.name,
      };
    } catch (error: any) {
      console.error('WhatsApp send error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        provider: this.name,
      };
    }
  }

  supportsFormat(format: MessageFormat): boolean {
    // WhatsApp supports text with basic markdown-style formatting
    return format === MessageFormat.TEXT;
  }

  canSendTo(recipient: MessageRecipient): boolean {
    return !!recipient.whatsapp;
  }

  /**
   * Format phone number for WhatsApp
   * Remove spaces, dashes, and ensure country code format
   */
  private formatWhatsAppNumber(phone: string): string {
    // Remove all non-numeric characters except +
    let formatted = phone.replace(/[^\d+]/g, '');
    
    // Ensure it has + prefix for country code
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }
    
    return formatted;
  }

  /**
   * Check if WhatsApp API instance is ready
   */
  async checkInstance(): Promise<boolean> {
    try {
      const response = await this.client.get(`/instance/${this.config.instanceId}/status`);
      return response.data.status === 'ready' || response.data.connected === true;
    } catch (error) {
      console.error('WhatsApp instance check error:', error);
      return false;
    }
  }
}
