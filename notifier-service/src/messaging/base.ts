/**
 * Base messaging interface
 * Defines contract for all messaging providers
 */

export enum MessageFormat {
  HTML = 'html',
  TEXT = 'text'
}

export interface MessageContent {
  format: MessageFormat;
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface MessageRecipient {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

/**
 * Abstract base class for all messaging providers
 */
export abstract class BaseMessagingProvider {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Send message to recipient
   */
  abstract send(
    recipient: MessageRecipient,
    content: MessageContent
  ): Promise<MessageResult>;

  /**
   * Check if provider supports the given format
   */
  abstract supportsFormat(format: MessageFormat): boolean;

  /**
   * Convert HTML to plain text if needed
   */
  protected htmlToText(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Prepare content based on supported format
   */
  protected prepareContent(content: MessageContent): string {
    if (content.format === MessageFormat.TEXT) {
      return content.body;
    }

    // If provider doesn't support HTML, convert to text
    if (!this.supportsFormat(MessageFormat.HTML)) {
      return this.htmlToText(content.body);
    }

    return content.body;
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Validate if provider can send to recipient
   */
  abstract canSendTo(recipient: MessageRecipient): boolean;
}
