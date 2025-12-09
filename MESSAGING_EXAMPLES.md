# Messaging System Examples

This document provides examples of how to use the multi-channel messaging system.

## Basic Usage

### Sending an Email (SMTP)

```typescript
import { SMTPProvider, MessageContent, MessageFormat, MessageRecipient } from './messaging';

// Initialize SMTP provider
const smtpProvider = new SMTPProvider({
  host: 'smtp.gmail.com',
  port: 587,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  },
  from: 'Market Watcher <noreply@marketwatcher.com>'
});

// Recipient
const recipient: MessageRecipient = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com'
};

// HTML Email
const htmlContent: MessageContent = {
  format: MessageFormat.HTML,
  subject: 'Market Alert: AAPL ↑ 5.2%',
  body: `
    <h2>Stock Alert</h2>
    <p>Hello John,</p>
    <p>AAPL has increased by <strong>5.2%</strong>!</p>
  `
};

// Send
const result = await smtpProvider.send(recipient, htmlContent);
console.log(result.success); // true
console.log(result.messageId); // email-id
```

### Sending an SMS (Twilio)

```typescript
import { TwilioProvider } from './messaging';

// Initialize Twilio provider
const twilioProvider = new TwilioProvider({
  accountSid: 'your-account-sid',
  authToken: 'your-auth-token',
  fromNumber: '+1234567890'
});

// Recipient with phone
const recipient: MessageRecipient = {
  id: '1',
  name: 'John Doe',
  phone: '+1987654321'
};

// Text message
const textContent: MessageContent = {
  format: MessageFormat.TEXT,
  subject: 'Market Alert',
  body: 'AAPL has increased by 5.2%! Current price: $175.23'
};

const result = await twilioProvider.send(recipient, textContent);
```

### Sending a WhatsApp Message

```typescript
import { WhatsAppProvider } from './messaging';

// Initialize WhatsApp provider (utter-labs/wa-bot-api)
const whatsappProvider = new WhatsAppProvider({
  apiUrl: 'http://your-whatsapp-api:3000',
  apiKey: 'your-api-key',
  instanceId: 'your-instance-id'
});

// Recipient with WhatsApp number
const recipient: MessageRecipient = {
  id: '1',
  name: 'John Doe',
  whatsapp: '+1987654321'
};

// Text with markdown-style formatting
const content: MessageContent = {
  format: MessageFormat.TEXT,
  subject: 'Market Alert',
  body: '*AAPL Alert*\n\nPrice increased by 5.2%\nCurrent: $175.23'
};

const result = await whatsappProvider.send(recipient, content);
```

## Using the Messaging Manager

The MessagingManager coordinates multiple providers:

```typescript
import { MessagingManager, SMTPProvider, TwilioProvider, WhatsAppProvider } from './messaging';

// Create manager
const manager = new MessagingManager();

// Register providers
manager.registerProvider(smtpProvider);
manager.registerProvider(twilioProvider);
manager.registerProvider(whatsappProvider);

// Recipient with multiple contact methods
const recipient: MessageRecipient = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1987654321',
  whatsapp: '+1987654321'
};

// HTML content (auto-converted to text for SMS/WhatsApp)
const content: MessageContent = {
  format: MessageFormat.HTML,
  subject: 'Market Alert: AAPL ↑ 5.2%',
  body: '<h2>AAPL Alert</h2><p>Price increased by 5.2%</p>'
};

// Send via all available channels
const results = await manager.send(recipient, content, {
  fallbackEnabled: true
});

// Check results
results.forEach(result => {
  console.log(`${result.provider}: ${result.success ? 'Sent' : 'Failed'}`);
});
```

## Preferred Provider with Fallback

```typescript
// Try email first, fallback to SMS/WhatsApp if email fails
const results = await manager.send(recipient, content, {
  preferredProviders: ['SMTP'],
  fallbackEnabled: true
});
```

## Send to Multiple Recipients

```typescript
const recipients: MessageRecipient[] = [
  { id: '1', email: 'user1@example.com' },
  { id: '2', phone: '+1234567890' },
  { id: '3', whatsapp: '+1987654321' }
];

const results = await manager.sendBulk(recipients, content);

// Results is a Map<recipientId, MessageResult[]>
results.forEach((recipientResults, recipientId) => {
  console.log(`Recipient ${recipientId}:`);
  recipientResults.forEach(result => {
    console.log(`  ${result.provider}: ${result.success}`);
  });
});
```

## Custom Provider Implementation

Create a new messaging provider by extending `BaseMessagingProvider`:

```typescript
import { BaseMessagingProvider, MessageContent, MessageRecipient, MessageResult, MessageFormat } from './messaging';

export class CustomProvider extends BaseMessagingProvider {
  constructor() {
    super('Custom');
  }

  async send(recipient: MessageRecipient, content: MessageContent): Promise<MessageResult> {
    try {
      // Your sending logic here
      const textContent = this.prepareContent(content);
      
      // Send via your API
      // ...
      
      return {
        success: true,
        messageId: 'custom-id',
        provider: this.name
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  supportsFormat(format: MessageFormat): boolean {
    return format === MessageFormat.TEXT;
  }

  canSendTo(recipient: MessageRecipient): boolean {
    return !!recipient.email; // Or your custom field
  }
}

// Use it
const customProvider = new CustomProvider();
manager.registerProvider(customProvider);
```

## HTML to Text Conversion

The base provider automatically converts HTML to text:

```typescript
const htmlContent = {
  format: MessageFormat.HTML,
  body: '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p>'
};

// When sent via SMS/WhatsApp (text-only providers)
// Automatically becomes:
// "Title\n\nParagraph with bold text."
```

## Error Handling

```typescript
try {
  const result = await provider.send(recipient, content);
  
  if (result.success) {
    console.log('Message sent:', result.messageId);
  } else {
    console.error('Failed to send:', result.error);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Best Practices

### 1. Provider Selection
- Use **SMTP** for detailed, formatted notifications
- Use **Twilio** for time-critical alerts
- Use **WhatsApp** for personal, conversational notifications

### 2. Content Format
- Create HTML content for rich emails
- Manager auto-converts to text for SMS/WhatsApp
- Or create text content directly for all channels

### 3. Fallback Strategy
```typescript
// Prefer email, but ensure delivery via SMS if email fails
{
  preferredProviders: ['SMTP', 'Twilio'],
  fallbackEnabled: true
}
```

### 4. Recipient Data
Ensure recipients have appropriate contact methods:
```typescript
// Check available providers for recipient
const availableProviders = manager.getAvailableProviders(recipient);
console.log(`Can send via: ${availableProviders.map(p => p.getName()).join(', ')}`);
```

## Integration with Market Watcher

In the notifier service:

```typescript
// Create HTML alert
const htmlMessage: MessageContent = {
  format: MessageFormat.HTML,
  subject: `Market Alert: ${symbol} ${direction} ${percent}%`,
  body: createHtmlAlert(user, stockData) // Your HTML template
};

// Send via all channels
const results = await messagingManager.send(recipient, htmlMessage, {
  fallbackEnabled: true
});

// Log results
results.forEach(result => {
  if (result.success) {
    // Save to database
    saveAlert(user.id, stockData, result.provider);
  }
});
```

## Testing

### Test SMTP Provider
```typescript
const smtpProvider = new SMTPProvider(config);
await smtpProvider.verify(); // Returns true if configured correctly
```

### Test WhatsApp Instance
```typescript
const whatsappProvider = new WhatsAppProvider(config);
const ready = await whatsappProvider.checkInstance(); // Returns true if instance is ready
```

## Environment Configuration

```env
# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Market Watcher <noreply@marketwatcher.com>"

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890

# WhatsApp (utter-labs/wa-bot-api)
WHATSAPP_API_URL=http://localhost:3000
WHATSAPP_API_KEY=your-api-key
WHATSAPP_INSTANCE_ID=instance-id
```

## Troubleshooting

### SMTP Issues
- Use app-specific passwords for Gmail
- Check firewall allows port 587
- Enable "Less secure app access" if needed

### Twilio Issues
- Verify phone numbers in trial mode
- Check account balance
- Ensure correct country code format

### WhatsApp Issues
- Verify wa-bot-api instance is running
- Check instance status endpoint
- Ensure phone number is registered
