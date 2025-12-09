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
   * Convert HTML to plain text
   * Basic sanitization to prevent HTML injection
   */
  protected htmlToText(html: string): string {
    // First, remove script tags completely
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove style tags
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Convert common HTML elements to text equivalents
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''); // Remove all remaining tags
    
    // Decode HTML entities in safe order
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&'); // Decode &amp; last to avoid double-decoding
    
    return text.trim();
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
