import { 
  ApiManager, 
  InitPaymentRequestPayload, 
  InitPaymentResponsePayload,
  WebhookPayload,
  Receipt as TinkoffReceipt,
  ReceiptItem as TinkoffReceiptItem
} from '@jfkz/tinkoff-payment-sdk';
import type { GetStateRequestPayload, GetStateResponsePayload } from '@jfkz/tinkoff-payment-sdk/dist/types/api-client/requests/get-state';
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

// Export SDK types
export type TinkoffInitResponse = InitPaymentResponsePayload;
export type TinkoffNotification = WebhookPayload;

// HTTP Client implementation for SDK
class SimpleHttpClient {
  async sendRequest(request: any): Promise<any> {
    console.log('[Tinkoff HTTP] Full request object:', JSON.stringify(request, null, 2));
    console.log('[Tinkoff HTTP] Request keys:', Object.keys(request));
    
    const url = request.url;
    const method = request.method || 'POST';
    
    // SDK может передавать данные в разных полях - проверим все
    const body = request.body || request.payload || request.data || request.json;
    
    console.log('[Tinkoff HTTP] Extracted values:', { 
      url, 
      method, 
      body: body ? (typeof body === 'string' ? JSON.parse(body) : body) : null 
    });

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('[Tinkoff HTTP] Raw response:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[Tinkoff HTTP] Parsed response:', data);
    } catch (e) {
      console.error('[Tinkoff HTTP] Failed to parse response:', e);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    return {
      statusCode: response.status,
      body: JSON.stringify(data),
    };
  }
}

class TinkoffAPI {
  private apiManager: ApiManager;
  private terminalKey: string;
  private password: string;

  constructor(terminalKey: string, password: string) {
    this.terminalKey = terminalKey;
    
    // Decode HTML entities from Replit Secrets (&amp; → &)
    this.password = password
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");

    console.log('[Tinkoff SDK] Initializing with TerminalKey:', terminalKey);
    console.log('[Tinkoff SDK] Password length:', this.password.length);
    console.log('[Tinkoff SDK] Password (first 3 chars):', this.password.substring(0, 3));

    // Initialize API Manager with our HTTP client
    this.apiManager = new ApiManager({
      terminalKey: this.terminalKey,
      password: this.password,
      httpClient: new SimpleHttpClient() as any,
    });
  }

  async init(request: TinkoffInitRequest): Promise<InitPaymentResponsePayload> {
    try {
      // Build SDK-compatible request
      const sdkRequest: InitPaymentRequestPayload = {
        OrderId: request.OrderId,
        Amount: request.Amount,
        Description: request.Description,
      };

      // Add optional fields
      if (request.DATA) {
        sdkRequest.DATA = request.DATA as any;
      }

      if (request.Receipt) {
        sdkRequest.Receipt = request.Receipt as any;
      }

      if (request.NotificationURL) {
        sdkRequest.NotificationURL = request.NotificationURL;
      }

      if (request.SuccessURL) {
        sdkRequest.SuccessURL = request.SuccessURL;
      }

      if (request.FailURL) {
        sdkRequest.FailURL = request.FailURL;
      }

      console.log('[Tinkoff SDK] Calling initPayment with:', sdkRequest);

      // Call SDK
      const response = await this.apiManager.initPayment(sdkRequest);

      console.log('[Tinkoff SDK] Init payment response:', response);

      if (!response.Success) {
        throw new Error(response.Message || `Tinkoff API error: ${response.ErrorCode}`);
      }

      return response;
    } catch (error: any) {
      console.error('[Tinkoff SDK] Init payment error:', error);
      throw error;
    }
  }

  async getState(paymentId: string): Promise<GetStateResponsePayload> {
    try {
      const request: GetStateRequestPayload = {
        PaymentId: paymentId,
      };

      const response = await this.apiManager.getState(request);

      if (!response.Success) {
        throw new Error(response.Message || `Tinkoff API error: ${response.ErrorCode}`);
      }

      return response;
    } catch (error: any) {
      console.error('[Tinkoff SDK] Get state error:', error);
      throw error;
    }
  }

  verifyNotification(notification: WebhookPayload): boolean {
    try {
      // Clone notification without Token
      const params: any = { ...notification };
      const receivedToken = params.Token;
      delete params.Token;

      // Add password and generate token
      params.Password = this.password;

      // Sort keys and concatenate values
      const sortedKeys = Object.keys(params).sort();
      const concatenated = sortedKeys.map(key => params[key]).join('');

      // Generate SHA-256 hash
      const expectedToken = crypto.createHash('sha256').update(concatenated).digest('hex');

      console.log('[Tinkoff SDK] Notification verification:', {
        receivedToken,
        expectedToken,
        match: receivedToken === expectedToken,
      });

      return receivedToken === expectedToken;
    } catch (error: any) {
      console.error('[Tinkoff SDK] Notification verification error:', error);
      return false;
    }
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
    let password = process.env.TINKOFF_SECRET_KEY;

    if (!terminalKey || !password) {
      throw new Error('Tinkoff credentials not configured');
    }

    password = decodeHTMLEntities(password);

    console.log('[Tinkoff] Creating singleton client');
    console.log('[Tinkoff] TerminalKey:', terminalKey);
    console.log('[Tinkoff] Password length:', password.length);

    tinkoffClient = new TinkoffAPI(terminalKey, password);
  }

  return tinkoffClient;
}

export { TinkoffAPI };
