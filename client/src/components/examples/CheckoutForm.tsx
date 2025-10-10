import CheckoutForm from '../CheckoutForm';

export default function CheckoutFormExample() {
  return (
    <div className="max-w-2xl p-6">
      <CheckoutForm
        onSubmit={(data) => console.log('Order submitted:', data)}
        onCancel={() => console.log('Cancelled')}
      />
    </div>
  );
}
