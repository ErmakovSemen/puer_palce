export type GoalType = 'cart' | 'payment' | 'registration';

const GOAL_URLS: Record<GoalType, string> = {
  cart: '/goal/cart',
  payment: '/goal/payment',
  registration: '/goal/registration',
};

export function submitGoalForm(goalType: GoalType) {
  const formId = `goal-${goalType}-form`;
  const form = document.getElementById(formId) as HTMLFormElement | null;
  
  if (form) {
    try {
      form.submit();
    } catch (error) {
      console.warn('Failed to submit goal form:', goalType, error);
    }
  }
}

export function GoalForms() {
  return (
    <>
      <iframe
        name="goal-iframe"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          border: 'none',
          left: '-9999px',
          top: '-9999px',
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
      
      <form
        id="goal-cart-form"
        action={GOAL_URLS.cart}
        method="POST"
        target="goal-iframe"
        style={{ 
          position: 'absolute',
          width: '1px',
          height: '1px',
          left: '-9999px',
          top: '-9999px',
          opacity: 0,
        }}
        aria-hidden="true"
      >
        <input type="hidden" name="goal" value="cart" />
      </form>
      
      <form
        id="goal-payment-form"
        action={GOAL_URLS.payment}
        method="POST"
        target="goal-iframe"
        style={{ 
          position: 'absolute',
          width: '1px',
          height: '1px',
          left: '-9999px',
          top: '-9999px',
          opacity: 0,
        }}
        aria-hidden="true"
      >
        <input type="hidden" name="goal" value="payment" />
      </form>
      
      <form
        id="goal-registration-form"
        action={GOAL_URLS.registration}
        method="POST"
        target="goal-iframe"
        style={{ 
          position: 'absolute',
          width: '1px',
          height: '1px',
          left: '-9999px',
          top: '-9999px',
          opacity: 0,
        }}
        aria-hidden="true"
      >
        <input type="hidden" name="goal" value="registration" />
      </form>
    </>
  );
}
