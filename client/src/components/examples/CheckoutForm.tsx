import CheckoutForm from '../CheckoutForm';

export default function CheckoutFormExample() {
  return (
    <div className="max-w-2xl p-6">
      <CheckoutForm
        total={950}
        onSubmit={(data) => console.log('Order submitted:', data)}
        onCancel={() => console.log('Cancelled')}
      />
    </div>
  );
}
