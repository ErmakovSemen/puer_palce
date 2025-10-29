import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  // Try direct API key first (for production deployments)
  const directApiKey = process.env.RESEND_API_KEY;
  if (directApiKey) {
    console.log('[Resend] Using direct API key from RESEND_API_KEY');
    return {
      apiKey: directApiKey,
      fromEmail: process.env.RESEND_FROM_EMAIL || null
    };
  }

  // Fall back to connector (for development)
  console.log('[Resend] Attempting to use Resend connector');
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Neither RESEND_API_KEY nor X_REPLIT_TOKEN found. Please set RESEND_API_KEY in deployment secrets.');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected via connector. Please set RESEND_API_KEY in deployment secrets.');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient() {
  const credentials = await getCredentials();
  
  // Get configured email from credentials or connector settings
  const configuredEmail = credentials.fromEmail || 
    (connectionSettings?.settings?.from_email);
  
  // Use configured email if it's a verified domain (not gmail/yahoo/etc)
  // Otherwise fall back to Resend's test email to avoid verification issues
  const isPublicDomain = configuredEmail && (
    configuredEmail.includes('@gmail.') || 
    configuredEmail.includes('@yahoo.') || 
    configuredEmail.includes('@hotmail.') ||
    configuredEmail.includes('@outlook.')
  );
  
  const fromEmail = (configuredEmail && !isPublicDomain) 
    ? configuredEmail 
    : 'onboarding@resend.dev';
  
  console.log('[Resend] Using from email:', fromEmail);
  
  return {
    client: new Resend(credentials.apiKey),
    fromEmail
  };
}

interface OrderItem {
  id: number;
  name: string;
  pricePerGram: number;
  quantity: number;
}

interface OrderData {
  name: string;
  email: string;
  phone: string;
  address: string;
  comment?: string;
  items: OrderItem[];
  total: number;
}

export async function sendOrderNotification(orderData: OrderData) {
  console.log('[Resend] Preparing to send order notification for:', orderData.name);
  console.log('[Resend] Order items:', orderData.items.map(i => `${i.name} - ${i.quantity}g`).join(', '));
  
  const { client, fromEmail } = await getUncachableResendClient();
  console.log('[Resend] Client initialized with from email:', fromEmail);
  
  // Format items list
  const itemsList = orderData.items.map(item => 
    `• ${item.name} - ${item.quantity}г × ${item.pricePerGram}₽/г = ${item.quantity * item.pricePerGram}₽`
  ).join('\n');
  
  const emailHtml = `
    <h2>Новый заказ от ${orderData.name}</h2>
    
    <h3>Контактные данные:</h3>
    <ul>
      <li><strong>Имя:</strong> ${orderData.name}</li>
      <li><strong>Email:</strong> ${orderData.email}</li>
      <li><strong>Телефон:</strong> ${orderData.phone}</li>
      <li><strong>Адрес доставки:</strong> ${orderData.address}</li>
      ${orderData.comment ? `<li><strong>Комментарий:</strong> ${orderData.comment}</li>` : ''}
    </ul>
    
    <h3>Состав заказа:</h3>
    <pre>${itemsList}</pre>
    
    <h3>Итого: ${orderData.total}₽</h3>
  `;

  console.log('[Resend] Sending email to: semen.learning@gmail.com');
  const result = await client.emails.send({
    from: fromEmail,
    to: 'semen.learning@gmail.com',
    subject: `Новый заказ от ${orderData.name}`,
    html: emailHtml,
  });

  console.log('[Resend] Email send result:', JSON.stringify(result, null, 2));
  
  // Check if Resend returned an error
  if ('error' in result && result.error) {
    console.error('[Resend] Email sending failed with error:', result.error);
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }
  
  console.log('[Resend] Email sent successfully. ID:', result.data?.id);
  return result;
}

export async function sendVerificationEmail(email: string, code: string, name?: string) {
  console.log('[Resend] Preparing to send verification email to:', email);
  
  const { client, fromEmail } = await getUncachableResendClient();
  console.log('[Resend] Client initialized with from email:', fromEmail);
  
  const emailHtml = `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-family: 'Playfair Display', serif; font-size: 32px; color: #000; margin-bottom: 10px;">
          Пуэр Паб
        </h1>
        <p style="color: #666; font-size: 16px;">
          Премиальный китайский пуэр
        </p>
      </div>
      
      <div style="background: #f9f9f9; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
        <h2 style="font-size: 24px; color: #000; margin-bottom: 20px;">
          Подтвердите ваш email
        </h2>
        
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
          ${name ? `Здравствуйте, ${name}!` : 'Здравствуйте!'}<br>
          Спасибо за регистрацию в Пуэр Паб.
        </p>
        
        <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
          Введите этот код для подтверждения вашего email:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <div style="background: #fff; border: 3px solid #000; border-radius: 8px; display: inline-block; padding: 20px 40px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #000;">
              ${code}
            </span>
          </div>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          Код действителен в течение 15 минут.
        </p>
      </div>
      
      <div style="text-align: center; color: #999; font-size: 12px;">
        <p>
          Если вы не регистрировались на сайте Пуэр Паб,<br>
          просто проигнорируйте это письмо.
        </p>
      </div>
    </div>
  `;

  console.log('[Resend] Sending verification email to:', email);
  const result = await client.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Подтвердите ваш email - Пуэр Паб',
    html: emailHtml,
  });

  console.log('[Resend] Verification email send result:', JSON.stringify(result, null, 2));
  
  if ('error' in result && result.error) {
    console.error('[Resend] Verification email sending failed:', result.error);
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }
  
  console.log('[Resend] Verification email sent successfully. ID:', result.data?.id);
  return result;
}
