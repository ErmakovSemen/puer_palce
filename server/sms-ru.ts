interface SmsRuResponse {
  status: string;
  status_code: number;
  sms?: {
    [phone: string]: {
      status: string;
      status_code: number;
      sms_id?: string;
    }
  };
  balance?: number;
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const apiKey = process.env.SMSRU_API_KEY;
  
  if (!apiKey) {
    console.error('[SMS.ru] API key not found. Set SMSRU_API_KEY in environment variables.');
    throw new Error('SMS.ru API key not configured');
  }

  const cleanPhone = phone.replace(/[^\d]/g, '');
  
  if (!cleanPhone.startsWith('7') && !cleanPhone.startsWith('8')) {
    throw new Error('Invalid phone number format. Must start with 7 or 8');
  }

  const formattedPhone = cleanPhone.startsWith('8') 
    ? '7' + cleanPhone.slice(1) 
    : cleanPhone;

  const templateId = process.env.SMSRU_TEMPLATE_ID;
  const useTemplate = !!templateId;

  console.log(`[SMS.ru] Sending verification code to ${formattedPhone}`);

  let params: URLSearchParams;
  
  if (useTemplate) {
    console.log(`[SMS.ru] Using template ${templateId} (cost-effective mode ~1₽/SMS)`);
    params = new URLSearchParams({
      api_id: apiKey,
      to: formattedPhone,
      msg_id: templateId,
      comment: code,
      from: 'PuerPub',
      json: '1',
    });
  } else {
    console.log(`[SMS.ru] Using regular SMS mode (~2₽/SMS). Set SMSRU_TEMPLATE_ID to reduce cost.`);
    const message = `Ваш код подтверждения: ${code}. Код действителен 5 минут.`;
    params = new URLSearchParams({
      api_id: apiKey,
      to: formattedPhone,
      msg: message,
      from: 'PuerPub',
      json: '1',
    });
  }

  try {
    const response = await fetch(`https://sms.ru/sms/send?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`[SMS.ru] HTTP error: ${response.status} ${response.statusText}`);
      throw new Error(`SMS.ru API error: ${response.status}`);
    }

    const data: SmsRuResponse = await response.json();
    
    console.log('[SMS.ru] Response:', JSON.stringify(data, null, 2));

    if (data.status_code !== 100) {
      const errorMessages: { [key: number]: string } = {
        200: 'Неправильный api_id',
        201: 'Не хватает средств на лицевом счёте',
        202: 'Неправильно указан номер телефона',
        203: 'Нет текста сообщения',
        204: 'Имя отправителя не согласовано с администрацией',
        205: 'Сообщение слишком длинное',
        206: 'Будет превышен или уже превышен дневной лимит',
        207: 'На этот номер нельзя отправлять сообщения',
        208: 'Параметр time указан неправильно',
        209: 'Вы добавили этот номер в стоп-лист',
        210: 'Используется GET, где необходимо использовать POST',
        211: 'Метод не найден',
        220: 'Сервис временно недоступен',
        300: 'Неправильный token',
        301: 'Неправильный пароль',
        302: 'Пользователь авторизован, но аккаунт не подтверждён',
      };

      const errorMessage = errorMessages[data.status_code] || `Unknown error: ${data.status_code}`;
      console.error(`[SMS.ru] Send failed: ${errorMessage}`);
      throw new Error(`SMS sending failed: ${errorMessage}`);
    }

    console.log(`[SMS.ru] SMS sent successfully. Balance: ${data.balance}`);
  } catch (error) {
    console.error('[SMS.ru] Error sending SMS:', error);
    throw error;
  }
}
