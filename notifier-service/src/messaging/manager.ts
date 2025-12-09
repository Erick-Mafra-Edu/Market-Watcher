/**
 * Messaging Manager
 * Coordinates multiple messaging providers
 */
import {
  BaseMessagingProvider,
  MessageContent,
  MessageRecipient,
  MessageResult,
} from './base';

export interface SendOptions {
  preferredProviders?: string[];
  fallbackEnabled?: boolean;
}

export class MessagingManager {
  private providers: Map<string, BaseMessagingProvider>;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Register a messaging provider
   */
  registerProvider(provider: BaseMessagingProvider): void {
    this.providers.set(provider.getName(), provider);
    console.log(`Registered messaging provider: ${provider.getName()}`);
  }

  /**
   * Get a specific provider
   */
  getProvider(name: string): BaseMessagingProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): BaseMessagingProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Send message using the most appropriate provider
   */
  async send(
    recipient: MessageRecipient,
    content: MessageContent,
    options?: SendOptions
  ): Promise<MessageResult[]> {
    const results: MessageResult[] = [];
    const preferredProviders = options?.preferredProviders || [];
    const fallbackEnabled = options?.fallbackEnabled !== false;

    // Try preferred providers first
    if (preferredProviders.length > 0) {
      for (const providerName of preferredProviders) {
        const provider = this.providers.get(providerName);
        if (provider && provider.canSendTo(recipient)) {
          const result = await provider.send(recipient, content);
          results.push(result);
          
          // If successful and fallback disabled, stop
          if (result.success && !fallbackEnabled) {
            return results;
          }
        }
      }
    }

    // If no preferred providers succeeded (or none specified), try all available
    if (results.length === 0 || results.every(r => !r.success)) {
      for (const provider of this.providers.values()) {
        // Skip if already tried
        if (preferredProviders.includes(provider.getName())) {
          continue;
        }

        if (provider.canSendTo(recipient)) {
          const result = await provider.send(recipient, content);
          results.push(result);

          // If successful and fallback disabled, stop
          if (result.success && !fallbackEnabled) {
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Send message to multiple recipients
   */
  async sendBulk(
    recipients: MessageRecipient[],
    content: MessageContent,
    options?: SendOptions
  ): Promise<Map<string, MessageResult[]>> {
    const results = new Map<string, MessageResult[]>();

    for (const recipient of recipients) {
      const recipientResults = await this.send(recipient, content, options);
      results.set(recipient.id, recipientResults);
    }

    return results;
  }

  /**
   * Send message using a specific provider
   */
  async sendViaProvider(
    providerName: string,
    recipient: MessageRecipient,
    content: MessageContent
  ): Promise<MessageResult> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      return {
        success: false,
        error: `Provider '${providerName}' not found`,
        provider: providerName,
      };
    }

    if (!provider.canSendTo(recipient)) {
      return {
        success: false,
        error: `Provider '${providerName}' cannot send to this recipient`,
        provider: providerName,
      };
    }

    return await provider.send(recipient, content);
  }

  /**
   * Get available providers for a recipient
   */
  getAvailableProviders(recipient: MessageRecipient): BaseMessagingProvider[] {
    return this.getAllProviders().filter(provider => 
      provider.canSendTo(recipient)
    );
  }
}
