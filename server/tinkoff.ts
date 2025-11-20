import crypto from 'crypto';

// Receipt item type for our application
export interface ReceiptItem {
  Name: string;
  Price: number;
  Quantity: number;
  Amount: number;
  Tax: string;
  PaymentMethod: string;
  PaymentObject: string;
}

// Our application's Tinkoff request interface
export interface TinkoffInitRequest {
  Amount: number;
  OrderId: string;
  Description: string;
  PayType?: string; // "O" for SBP (QR-code), omit for default card payment
  DATA?: {
    Email?: string;
    Phone?: string;
  };
  Receipt?: {
    Email?: string;
    Phone?: string;
    Taxation: string;
    Items: ReceiptItem[];
  };
  NotificationURL?: string;
  SuccessURL?: string;
  FailURL?: string;
}

interface TinkoffInitResponse {
  Success: boolean;
  ErrorCode: string;
  Message?: string;
  TerminalKey: string;
  Status: string;
  PaymentId: string;
  OrderId: string;
  Amount: number;
  PaymentURL: string;
}

interface TinkoffNotification {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: string;
  PaymentId: string;
  ErrorCode: string;
  Amount: number;
  CardId?: string;
  Pan?: string;
  ExpDate?: string;
  Token: string;
}

export type { TinkoffInitResponse, TinkoffNotification };

class TinkoffAPI {
  private terminalKey: string;
  private password: string;
  private apiUrl: string = 'https://securepay.tinkoff.ru/v2';

  constructor(terminalKey: string, password: string) {
    this.terminalKey = terminalKey;
    
    // Decode HTML entities from Replit Secrets (&amp; → &)
    this.password = password
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim(); // Remove leading/trailing whitespace

    console.log('[Tinkoff] Initialized with TerminalKey:', terminalKey);
  }

  private generateToken(params: Record<string, any>): string {
    // Clone params for token generation
    const tokenParams: Record<string, any> = { ...params };
    
    // Remove Token field if it exists
    delete tokenParams.Token;
    
    // Remove nested objects - they don't participate in token generation
    delete tokenParams.Receipt;
    delete tokenParams.DATA;
    
    // Add Password to params for token generation
    tokenParams.Password = this.password;
    
    // Sort keys alphabetically
    const sortedKeys = Object.keys(tokenParams).sort();
    
    console.log('[Token] Sorted keys:', sortedKeys);
    
    // Concatenate values
    const values = sortedKeys.map(key => tokenParams[key]).join('');
    
    console.log('[Token] Concatenated string for hashing:', values);
    
    // Generate SHA-256 hash
    const token = crypto.createHash('sha256').update(values).digest('hex');
    
    console.log('[Token] Generated token:', token);
    
    return token;
  }

  async init(request: TinkoffInitRequest): Promise<TinkoffInitResponse> {
    const params: any = {
      TerminalKey: this.terminalKey,
      Amount: request.Amount,
      OrderId: request.OrderId,
      Description: request.Description,
    };

    if (request.PayType) {
      params.PayType = request.PayType;
    }

    if (request.DATA) {
      params.DATA = request.DATA;
    }

    if (request.Receipt) {
      params.Receipt = request.Receipt;
    }

    if (request.NotificationURL) {
      params.NotificationURL = request.NotificationURL;
    }

    if (request.SuccessURL) {
      params.SuccessURL = request.SuccessURL;
    }

    if (request.FailURL) {
      params.FailURL = request.FailURL;
    }

    // Generate token
    params.Token = this.generateToken(params);

    console.log('[Tinkoff] Full request:', JSON.stringify(params, null, 2));

    const response = await fetch(`${this.apiUrl}/Init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    console.log('[Tinkoff] Response:', JSON.stringify(data, null, 2));

    if (!data.Success) {
      console.error('[Tinkoff] Error details:', {
        Message: data.Message,
        ErrorCode: data.ErrorCode,
        Details: data.Details,
      });
      throw new Error(data.Message || `Tinkoff API error: ${data.ErrorCode}`);
    }

    return data;
  }

  async getState(paymentId: string): Promise<any> {
    const params = {
      TerminalKey: this.terminalKey,
      PaymentId: paymentId,
    };

    const token = this.generateToken(params);

    const response = await fetch(`${this.apiUrl}/GetState`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        Token: token,
      }),
    });

    const data = await response.json();

    if (!data.Success) {
      throw new Error(data.Message || `Tinkoff API error: ${data.ErrorCode}`);
    }

    return data;
  }

  verifyNotification(notification: TinkoffNotification): boolean {
    const params: any = { ...notification };
    delete params.Token;

    const expectedToken = this.generateToken(params);
    return expectedToken === notification.Token;
  }

  getNotificationSuccessResponse(): string {
    return 'OK';
  }
}

// Singleton instance
let tinkoffClient: TinkoffAPI | null = null;

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function getTinkoffClient(): TinkoffAPI {
  if (!tinkoffClient) {
    const terminalKey = process.env.TINKOFF_TERMINAL_KEY;
    const password = process.env.TINKOFF_SECRET_KEY;

    if (!terminalKey || !password) {
      throw new Error('Tinkoff credentials not configured');
    }

    console.log('[Tinkoff] Creating singleton client');
    console.log('[Tinkoff] TerminalKey:', terminalKey);

    tinkoffClient = new TinkoffAPI(terminalKey, password);
  }

  return tinkoffClient;
}

export { TinkoffAPI };
