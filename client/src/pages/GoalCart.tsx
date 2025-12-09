export default function GoalCart() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-serif font-bold text-center mb-6">
          Переход в корзину
        </h1>
        <form
          id="goal-cart-form"
          action="/goal/cart"
          method="POST"
          className="space-y-4"
          data-testid="form-goal-cart"
        >
          <input type="hidden" name="goal" value="cart" />
          <input type="hidden" name="timestamp" value={new Date().toISOString()} />
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-md font-medium"
            data-testid="button-submit-cart"
          >
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}
