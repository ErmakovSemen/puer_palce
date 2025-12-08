export type GoalType = 'cart' | 'payment' | 'registration';

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
          display: 'none',
          width: 0,
          height: 0,
          border: 'none',
          position: 'absolute',
          left: '-9999px',
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
      
      <form
        id="goal-cart-form"
        action="about:blank"
        method="POST"
        target="goal-iframe"
        style={{ display: 'none' }}
        aria-hidden="true"
      >
        <input type="hidden" name="goal" value="cart" />
      </form>
      
      <form
        id="goal-payment-form"
        action="about:blank"
        method="POST"
        target="goal-iframe"
        style={{ display: 'none' }}
        aria-hidden="true"
      >
        <input type="hidden" name="goal" value="payment" />
      </form>
      
      <form
        id="goal-registration-form"
        action="about:blank"
        method="POST"
        target="goal-iframe"
        style={{ display: 'none' }}
        aria-hidden="true"
      >
        <input type="hidden" name="goal" value="registration" />
      </form>
    </>
  );
}
