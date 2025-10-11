import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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
    throw new Error('Resend not connected');
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
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
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

  console.log('[Resend] Email sent successfully. Result:', result);
  return result;
}
