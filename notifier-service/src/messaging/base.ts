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
   * Comprehensive sanitization to prevent HTML injection
   * Used for converting HTML emails to SMS/WhatsApp text format
   */
  protected htmlToText(html: string): string {
    // Remove all script and style tags with their content
    // This handles variations like <script >, <script\n>, etc.
    let text = html;
    
    // Remove script tags (multiple passes to handle nested or malformed tags)
    while (/<script/i.test(text)) {
      text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
      text = text.replace(/<script\b[^>]*>/gi, ''); // Remove unclosed tags
    }
    
    // Remove style tags
    while (/<style/i.test(text)) {
      text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
      text = text.replace(/<style\b[^>]*>/gi, ''); // Remove unclosed tags
    }
    
    // Remove any remaining potentially dangerous tags
    text = text.replace(/<(iframe|object|embed|link)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    
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
    
    // Remove any remaining < or > that might have been missed
    text = text.replace(/[<>]/g, '');
    
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
