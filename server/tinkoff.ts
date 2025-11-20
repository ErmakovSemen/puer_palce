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
    this.password = password;
  }

  private generateToken(params: Record<string, any>): string {
    // Add Password to params for token generation
    const tokenParams: Record<string, any> = { ...params, Password: this.password };
    
    // Remove Token field if it exists
    delete tokenParams.Token;
    
    // Remove Receipt and DATA fields as they are not included in token generation
    delete tokenParams.Receipt;
    delete tokenParams.DATA;
    delete tokenParams.NotificationURL;
    delete tokenParams.SuccessURL;
    delete tokenParams.FailURL;
    
    // Sort keys alphabetically
    const sortedKeys = Object.keys(tokenParams).sort();
    
    // Concatenate values
    const values = sortedKeys.map(key => tokenParams[key]).join("");
    
    // Generate SHA-256 hash
    return crypto.createHash("sha256").update(values).digest("hex");
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

    if (!data.Success) {
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

export function getTinkoffClient(): TinkoffAPI {
  if (!tinkoffClient) {
    const terminalKey = process.env.TINKOFF_TERMINAL_KEY;
    const password = process.env.TINKOFF_SECRET_KEY;

    if (!terminalKey || !password) {
      throw new Error("Tinkoff credentials not configured");
    }

    tinkoffClient = new TinkoffAPI(terminalKey, password);
  }

  return tinkoffClient;
}

export { TinkoffAPI, TinkoffInitRequest, TinkoffInitResponse, TinkoffNotification };
