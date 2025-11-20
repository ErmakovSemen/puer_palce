import crypto from "crypto";

interface TinkoffInitRequest {
  Amount: number; // Amount in kopecks
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
    Items: Array<{
      Name: string;
      Price: number; // Price in kopecks
      Quantity: number;
      Amount: number; // Total in kopecks
      Tax: string;
    }>;
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

class TinkoffAPI {
  private terminalKey: string;
  private password: string;
  private apiUrl: string = "https://securepay.tinkoff.ru/v2";

  constructor(terminalKey: string, password: string) {
    this.terminalKey = terminalKey;
    // Decode HTML entities from Replit Secrets (&amp; → &)
    this.password = password
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    
    console.log("[Tinkoff] Initializing client with TerminalKey:", terminalKey);
    console.log("[Tinkoff] Password length:", this.password.length);
    console.log("[Tinkoff] Password (first 3 chars):", this.password.substring(0, 3));
  }

  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }
    
    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObjectKeys(obj[key]);
    });
    return sorted;
  }

  private generateToken(params: Record<string, any>): string {
    // Clone params for token generation
    const tokenParams: Record<string, any> = { ...params };
    
    // Remove Token field if it exists
    delete tokenParams.Token;
    
    // Remove fields that don't participate in token generation
    // Per Tinkoff documentation: only primitive root-level fields participate
    delete tokenParams.NotificationURL;
    delete tokenParams.SuccessURL;
    delete tokenParams.FailURL;
    delete tokenParams.Receipt;  // Receipt does NOT participate in token
    delete tokenParams.DATA;     // DATA does NOT participate in token
    
    // Add Password to params for token generation
    tokenParams.Password = this.password;
    
    // Sort keys alphabetically
    const sortedKeys = Object.keys(tokenParams).sort();
    
    console.log("[Token] Sorted keys:", sortedKeys);
    console.log("[Token] Token params:", tokenParams);
    
    // Concatenate values
    const values = sortedKeys.map(key => tokenParams[key]).join("");
    
    console.log("[Token] Concatenated string for hashing:", values);
    
    // Generate SHA-256 hash
    const token = crypto.createHash("sha256").update(values).digest("hex");
    
    console.log("[Token] Generated token:", token);
    
    return token;
  }

  async init(request: TinkoffInitRequest): Promise<TinkoffInitResponse> {
    const params: any = {
      TerminalKey: this.terminalKey,
      Amount: request.Amount,
      OrderId: request.OrderId,
      Description: request.Description,
    };

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

    const response = await fetch(`${this.apiUrl}/Init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    console.log("[Tinkoff API] Full response:", JSON.stringify(data, null, 2));

    if (!data.Success) {
      console.error("[Tinkoff API] Error details:", {
        Message: data.Message,
        ErrorCode: data.ErrorCode,
        Details: data.Details,
        FullResponse: data
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    // Clone notification without Token
    const params: any = { ...notification };
    delete params.Token;

    const expectedToken = this.generateToken(params);
    return expectedToken === notification.Token;
  }

  getNotificationSuccessResponse(): string {
    return "OK";
  }
}

// Singleton instance
let tinkoffClient: TinkoffAPI | null = null;

function decodeHTMLEntities(text: string): string {
  // Decode common HTML entities that might appear in secrets
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
      throw new Error("Tinkoff credentials not configured");
    }

    // Decode HTML entities in password (Replit Secrets may encode &)
    password = decodeHTMLEntities(password);

    console.log("[Tinkoff] Initializing client with TerminalKey:", terminalKey);
    console.log("[Tinkoff] Password length:", password.length);
    console.log("[Tinkoff] Password (first 3 chars):", password.substring(0, 3));

    tinkoffClient = new TinkoffAPI(terminalKey, password);
  }

  return tinkoffClient;
}

export { TinkoffAPI, TinkoffInitRequest, TinkoffInitResponse, TinkoffNotification };
