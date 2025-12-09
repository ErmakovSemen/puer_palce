export default function GoalPayment() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-serif font-bold text-center mb-6">
          Успешная оплата
        </h1>
        <form
          id="goal-payment-form"
          action="/goal/payment"
          method="POST"
          className="space-y-4"
          data-testid="form-goal-payment"
        >
          <input type="hidden" name="goal" value="payment" />
          <input type="hidden" name="timestamp" value={new Date().toISOString()} />
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-md font-medium"
            data-testid="button-submit-payment"
          >
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}
